




import { GoogleGenAI, Modality, LiveServerMessage, FunctionCall, FunctionResponse, LiveConnectConfig, LiveServerContent } from '@google/genai';
import { GEMINI_LIVE_MODEL_NAME, SYSTEM_INSTRUCTION_BARISTA_BOT, BARISTA_FUNCTION_DECLARATIONS, AUDIO_INPUT_MIME_TYPE } from '../constants';
import { SubmitOrderArgs, FunctionCallResponseData, GeminiLiveSession, GeminiServerMessage } from '../types';

interface LiveAiServiceCallbacks {
  onOpen: () => void;
  onMessage: (message: GeminiServerMessage) => void;
  onError: (error: Error) => void;
  onClose: (event: CloseEvent) => void;
  onInputTranscription: (text: string) => void;
  onOutputTranscription: (text: string) => void;
  onAiAudioData: (base64Audio: string) => void;
  onToolCall: (call: FunctionCall) => Promise<FunctionResponse>; 
  onTurnComplete: () => void;
  onInterrupted: () => void;
}

export class LiveAiService {
  private ai: GoogleGenAI;
  private session: GeminiLiveSession | null = null;
  private responseQueue: GeminiServerMessage[] = [];
  private isProcessingQueue: boolean = false;
  private callbacks: LiveAiServiceCallbacks;
  private currentSessionHandle: string | null = null; // For Session Resumption

  constructor(apiKey: string, callbacks: LiveAiServiceCallbacks) {
    if (!apiKey) {
      throw new Error("API key is required for LiveAiService.");
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.callbacks = callbacks;
  }

  private async processResponseQueue() {
    if (this.isProcessingQueue || this.responseQueue.length === 0) {
      return;
    }
    this.isProcessingQueue = true;
    const message = this.responseQueue.shift();

    if (message) {
      this.callbacks.onMessage(message); 

      if (message.serverContent) {
        if (message.serverContent.inputTranscription?.text) {
          this.callbacks.onInputTranscription(message.serverContent.inputTranscription.text);
        }
        if (message.serverContent.outputTranscription?.text) {
          this.callbacks.onOutputTranscription(message.serverContent.outputTranscription.text);
        }
        if (message.serverContent.interrupted) {
            this.callbacks.onInterrupted();
        }
        if (message.serverContent.turnComplete) {
          this.callbacks.onTurnComplete();
        }
        // Session Resumption Update is handled directly in onmessage to update handle ASAP
      }
      
      if (message.data) { 
        this.callbacks.onAiAudioData(message.data);
      }

      if (message.toolCall && message.toolCall.functionCalls) {
        const responses: FunctionResponse[] = [];
        for (const fc of message.toolCall.functionCalls) {
          const toolResponse = await this.callbacks.onToolCall(fc);
          responses.push(toolResponse);
        }
        if (this.session && responses.length > 0) {
          this.session.sendToolResponse({ functionResponses: responses });
        }
         this.callbacks.onTurnComplete(); 
      }
    }
    this.isProcessingQueue = false;
    if(this.responseQueue.length > 0) {
        setTimeout(() => this.processResponseQueue(), 0);
    }
  }

  public async connect(): Promise<void> {
    if (this.session) {
      console.warn("Session already exists.");
      return;
    }

    const sessionConfig: LiveConnectConfig = { 
      responseModalities: [Modality.AUDIO],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      tools: [{ functionDeclarations: BARISTA_FUNCTION_DECLARATIONS }],
      systemInstruction: SYSTEM_INSTRUCTION_BARISTA_BOT,
      contextWindowCompression: { slidingWindow: {} }, // Enable Context Window Compression
      sessionResumption: {}, // Always enable session resumption to receive updates/handles
    };

    if (this.currentSessionHandle) {
      sessionConfig.sessionResumption!.handle = this.currentSessionHandle;
      console.log('[LiveAiService] Attempting to resume session with handle:', this.currentSessionHandle);
    }


    try {
      this.session = await this.ai.live.connect({
        model: GEMINI_LIVE_MODEL_NAME,
        config: sessionConfig,
        callbacks: {
          onopen: () => {
            this.responseQueue = []; 
            this.callbacks.onOpen();
          },
          onmessage: (message: LiveServerMessage) => { 
            // Handle SessionResumptionUpdate immediately
            const serverContent: LiveServerContent | undefined = message.serverContent; 
            const sessionStateUpdate = serverContent?.sessionStateUpdate; 
            if (sessionStateUpdate?.resumable && sessionStateUpdate?.handle) {
              this.currentSessionHandle = sessionStateUpdate.handle;
              console.log('[LiveAiService] Updated session resumption handle:', this.currentSessionHandle);
            }
            this.responseQueue.push(message as GeminiServerMessage); 
            this.processResponseQueue();
          },
          onerror: (e: ErrorEvent) => { 
            this.callbacks.onError(new Error(e.message || 'Live AI WebSocket error'));
          },
          onclose: (e: CloseEvent) => {
            // Don't clear currentSessionHandle here if it was a temporary disconnect that might be resumed.
            // Clear it on explicit close or unrecoverable error.
            this.session = null;
            this.callbacks.onClose(e);
          },
        },
      });
    } catch (error) {
      this.callbacks.onError(error as Error);
      this.currentSessionHandle = null; // Clear handle on connection error
    }
  }

  public sendAudioData(base64Audio: string): void {
    if (!this.session) {
      this.callbacks.onError(new Error("Session not initialized. Cannot send audio."));
      return;
    }
    this.session.sendRealtimeInput({
      audio: {
        data: base64Audio,
        mimeType: AUDIO_INPUT_MIME_TYPE,
      },
    });
  }
  
  public sendAudioStreamEnd(): void {
    if (!this.session) {
      return; 
    }
    this.session.sendRealtimeInput({ audioStreamEnd: true });
  }

  public closeSession(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
    this.responseQueue = []; 
    this.currentSessionHandle = null; // Clear handle on explicit close
    console.log('[LiveAiService] Session closed and resumption handle cleared.');
  }

  public isConnected(): boolean {
    return this.session !== null;
  }
  
  // Renamed and updated for Barista Bot
  public static async handleBaristaFunctionCall(fc: FunctionCall): Promise<FunctionResponse> {
    let resultData: FunctionCallResponseData;

    console.log(`[Barista AI] Executing function: ${fc.name} with args:`, JSON.stringify(fc.args));

    if (!fc.args) {
        console.error(`[Barista AI] Missing arguments for function: ${fc.name}`);
        resultData = { status: 'failure', message: `Argumen tidak ditemukan untuk fungsi ${fc.name}` };
        return {
          id: fc.id,
          name: fc.name,
          response: resultData,
        };
    }
    const args = fc.args as unknown as SubmitOrderArgs; 

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 300));

    try {
        switch (fc.name) {
        case 'submit_order':
            
            if (!args.nama_pelanggan || !args.pesanan || !args.waktu_pemesanan) {
                console.error(`[Barista AI] Missing one or more required arguments in submit_order: nama_pelanggan, pesanan, waktu_pemesanan. Received:`, args);
                resultData = { status: 'failure', message: "Data pesanan tidak lengkap. Mohon pastikan nama, detail pesanan, dan waktu pemesanan terisi." };
                break;
            }

            console.log(`[Barista AI] SIMULATED submit_order for ${args.nama_pelanggan} with order: "${args.pesanan}" at ${args.waktu_pemesanan}`);
            // Simulate a successful submission for now
            const isSimulatedSuccess = Math.random() > 0.1; // 90% chance of success for simulation
            if (isSimulatedSuccess) {
                 resultData = { 
                    status: 'success', 
                    message: "Pesanan Anda telah berhasil dikirim ke sistem kami! (Simulasi)",
                    data: { customerName: args.nama_pelanggan, orderDetails: args.pesanan, orderTime: args.waktu_pemesanan }
                };
            } else {
                 resultData = { 
                    status: 'failure', 
                    message: "Maaf, terjadi sedikit kendala saat mengirimkan pesanan Anda ke sistem. (Simulasi)",
                    data: { error: "Simulated submission failure" }
                };
            }
            break;
        default:
            console.warn(`[Barista AI] Unknown function called: ${fc.name}`);
            resultData = { status: 'failure', message: `Fungsi tidak dikenal: ${fc.name}` };
        }
    } catch (e: any) {
        console.error(`[Barista AI] Error executing function ${fc.name}:`, e);
        resultData = { status: 'failure', message: `Error memproses permintaan Anda untuk ${fc.name}: ${e.message}`};
    }
    
    return {
      id: fc.id,
      name: fc.name,
      response: resultData, 
    };
  }
}
