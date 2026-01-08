import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
