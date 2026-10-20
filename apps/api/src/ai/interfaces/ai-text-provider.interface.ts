export interface GenerateTextOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateTextResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  model: string;
  provider: string;
  costEstimateMicrocents: number;
  isSimulated?: boolean;
}

export interface AiTextProvider {
  readonly providerName: string;
  generateText(options: GenerateTextOptions): Promise<GenerateTextResult>;
}
