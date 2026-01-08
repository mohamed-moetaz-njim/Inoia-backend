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
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

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
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('GEMINI_API_KEY is not defined');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
    });
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
    // 1. Verify conversation ownership or create new if not exists (though controller should handle id)
    const conversation = await this.prisma.aiConversation.findUnique({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });

    if (!conversation) {
      // In case we want to allow creating by posting to a new ID, but typically we'd use a separate create endpoint or handle 'new'
      // For now assume valid conversationId passed, or handle elsewhere.
      // If we want to support "start new conversation" logic via this method, we might need adjustments.
      // Let's assume strict checking for now.
      throw new InternalServerErrorException('Conversation not found');
    }

    // 2. Save User Message
    const userMessage = await this.prisma.aiMessage.create({
      data: {
        conversationId,
        sender: AiSender.USER,
        content,
      },
    });

    // Update conversation last activity
    await this.prisma.aiConversation.update({
      where: { id: conversationId },
      data: { lastActivityAt: new Date() },
    });

    // 3. Analyze Message
    let analysis: AnalysisResult;
    try {
      analysis = await this.analyzeMessage(content, conversation.messages);
    } catch (error) {
      this.logger.error('Analysis failed', error);
      // Fallback safe analysis
      analysis = {
        emotionalState: 'unknown',
        themes: [],
        riskLevel: 0,
        recommendedApproach: 'listen',
      };
    }

    // 4. Check Risk Level & Generate Response
    let aiResponseContent: string;

    if (analysis.riskLevel >= 8) {
      aiResponseContent =
        "I'm here to listen, but if you're in crisis, please reach out to a trusted adult or professional.";
    } else {
      try {
        aiResponseContent = await this.generateResponse(
          content,
          analysis,
          conversation.messages,
        );
      } catch (error) {
        this.logger.error('Response generation failed', error);
        aiResponseContent =
          "I'm having trouble responding right now. Please try again.";
      }
    }

    // 5. Save AI Response
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
      analysis, // Optional: return analysis for debugging/client usage if needed
    };
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

    const result = await this.model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Clean up markdown code blocks if present
    const cleanText = text.replace(/```json\n?|\n?```/g, '').trim();

    try {
      return JSON.parse(cleanText) as AnalysisResult;
    } catch (e) {
      this.logger.error('Failed to parse analysis JSON', text);
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

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }
}
