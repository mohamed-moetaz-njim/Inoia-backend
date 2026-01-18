import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { PrismaService } from '../prisma/prisma.service';
import { AiSender, AiMessage } from '@prisma/client';

export interface AnalysisResult {
  emotionalState: string;
  themes: string[];
  riskLevel: number;
  recommendedApproach: string;
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);
  private models: GenerativeModel[] = [];
  private modelName: string;

  private readonly SYSTEM_PROMPT = `You are a compassionate, non-judgmental AI listener for students facing mental health challenges.
Your role is to:

Listen empathetically and validate feelings
Use open-ended questions and reflective statements
Encourage self-reflection and coping strategies
NEVER diagnose, prescribe medication, or give medical advice
If riskLevel is high (7+), gently suggest professional help
Always prioritize safety and well-being`;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKeysString = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKeysString) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not defined');
    }
    this.modelName =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

    const keys = apiKeysString.split(',').map((k) => k.trim()).filter((k) => k);

    if (keys.length === 0) {
      throw new InternalServerErrorException('No valid GEMINI_API_KEY found');
    }

    this.models = keys.map((key) => {
      const genAI = new GoogleGenerativeAI(key);
      return genAI.getGenerativeModel({
        model: this.modelName,
      });
    });

    this.logger.log(`Initialized AI Chat Service with ${this.models.length} API key(s)`);
  }

  /**
   * Executes a Gemini operation with fallback to secondary keys if the first one fails.
   */
  private async executeWithFallback<T>(
    operation: (model: GenerativeModel) => Promise<T>,
  ): Promise<T> {
    let lastError: any;

    for (let i = 0; i < this.models.length; i++) {
      try {
        return await operation(this.models[i]);
      } catch (error) {
        lastError = error;
        const isLastModel = i === this.models.length - 1;
        
        // Log warning but continue to next model
        this.logger.warn(
          `Gemini call failed with key #${i + 1}. ${isLastModel ? 'No more keys to try.' : 'Retrying with next key...'}`,
          {
             errorName: error.name,
             errorMessage: error.message,
             httpStatus: error.status || error.response?.status,
          }
        );

        if (isLastModel) break;
      }
    }

    throw lastError;
  }

  async getUserConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { lastActivityAt: 'desc' },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      throw new InternalServerErrorException('Conversation not found');
    }

    return conversation;
  }

  async createConversation(userId: string) {
    return this.prisma.aiConversation.create({
      data: {
        userId,
        lastActivityAt: new Date(),
      },
      include: {
        messages: true,
      },
    });
  }

  async processUserMessage(
    userId: string,
    conversationId: string,
    content: string,
  ) {
    // Verify conversation ownership
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      throw new InternalServerErrorException('Conversation not found');
    }

    const userMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        sender: AiSender.USER,
        content,
      },
    });

    if (conversation.messages.length === 0) {
      await this.generateConversationTitle(conversationId, content);
    }

    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date() },
    });

    let analysis: AnalysisResult;
    try {
      analysis = await this.analyzeMessage(content, conversation.messages);
    } catch (error) {
      this.logger.error('Gemini call failed', {
        step: 'analyzeMessage',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        httpStatus: error.status || error.response?.status,
        model: this.modelName,
      });
      // Fallback safe analysis
      analysis = {
        emotionalState: 'unknown',
        themes: [],
        riskLevel: 0,
        recommendedApproach: 'listen',
      };
    }

    let aiResponseContent: string;

    try {
      aiResponseContent = await this.generateResponse(
        content,
        analysis,
        conversation.messages,
      );
    } catch (error) {
      this.logger.error('Gemini call failed', {
        step: 'generateResponse',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        httpStatus: error.status || error.response?.status,
        model: this.modelName,
      });
      aiResponseContent =
        "I'm having trouble responding right now. Please try again.";
    }

    // Append safety guidance for elevated risk (7+)
    if (analysis.riskLevel >= 7) {
      const safetyMessage =
        "\n\nIf you're going through a difficult time, please consider reaching out to a trusted adult or a mental health professional. You don't have to face this alone.";
      aiResponseContent += safetyMessage;
    }

    const aiMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        sender: AiSender.AI,
        content: aiResponseContent,
      },
    });

    return {
      userMessage,
      aiMessage,
      analysis,
    };
  }

  private async generateConversationTitle(
    conversationId: string,
    firstMessage: string,
  ) {
    try {
      const prompt = `Summarize this message into a short conversation title (3-8 words, natural and empathetic): '${firstMessage}'`;
      
      const result = await this.executeWithFallback((model) => 
        model.generateContent(prompt)
      );

      const title = result.response
        .text()
        .trim()
        .replace(/^["']|["']$/g, '');

      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title },
      });
    } catch (error) {
      this.logger.error('Gemini call failed', {
        step: 'generateConversationTitle',
        errorName: error.name,
        errorMessage: error.message,
        errorCode: error.code,
        httpStatus: error.status || error.response?.status,
        model: this.modelName,
      });
      const fallbackTitle =
        firstMessage.substring(0, 30) + (firstMessage.length > 30 ? '...' : '');
      await this.prisma.aiConversation.update({
        where: { id: conversationId },
        data: { title: fallbackTitle },
      });
    }
  }

  private async analyzeMessage(
    content: string,
    history: AiMessage[],
  ): Promise<AnalysisResult> {
    const prompt = `
    Analyze the following message and conversation history from a mental health perspective.
    Return ONLY a raw JSON object (no markdown formatting) with the following structure:
    {
      "emotionalState": string (e.g., "anxious", "hopeless", "calm"),
      "themes": string[] (array of key themes),
      "riskLevel": number (0-10, where 10 is immediate danger),
      "recommendedApproach": string (brief suggestion for the responder)
    }

    User Message: "${content}"
    
    Previous Context (last 3 messages):
    ${history
      .slice(-3)
      .map((m) => `${m.sender}: ${m.content}`)
      .join('\n')}
    `;

    const result = await this.executeWithFallback((model) => 
      model.generateContent(prompt)
    );
    const response = result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(cleanText) as AnalysisResult;
    } catch (e) {
      this.logger.error('Failed to parse analysis JSON');
      throw e;
    }
  }

  private async generateResponse(
    content: string,
    analysis: AnalysisResult,
    history: AiMessage[],
  ): Promise<string> {
    const prompt = `
    ${this.SYSTEM_PROMPT}

    Current User Analysis:
    - Emotional State: ${analysis.emotionalState}
    - Themes: ${analysis.themes.join(', ')}
    - Risk Level: ${analysis.riskLevel}
    - Recommended Approach: ${analysis.recommendedApproach}

    Conversation History (last 5 messages):
    ${history
      .slice(-5)
      .map((m: AiMessage) => `${m.sender}: ${m.content}`)
      .join('\n')}
    
    User's Latest Message: "${content}"

    Draft a compassionate, short, and supportive response.
    `;

    const result = await this.executeWithFallback((model) => 
      model.generateContent(prompt)
    );
    return result.response.text();
  }
}
