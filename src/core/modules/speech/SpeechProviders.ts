/**
 * SpeechOutputProvider 클래스는 speechSynthesis API를 사용하여 텍스트를 음성으로 변환하며,
 * 시스템에 설치된 음성 목록을 관리합니다.
 */
export class SpeechOutputProvider {
    private static voices: SpeechSynthesisVoice[] | null = null;

    private constructor() { }

    private static async populateVoiceList(): Promise<SpeechSynthesisVoice[]> {
        return new Promise((resolve) => {
            const synth = window.speechSynthesis;

            synth.onvoiceschanged = () => {
                const voices = synth.getVoices().sort((a, b) => {
                    const aname = a.name.toUpperCase();
                    const bname = b.name.toUpperCase();
                    if (aname < bname) return -1;
                    else if (aname === bname) return 0;
                    else return +1;
                });

                resolve(voices);
            };

            if (synth.getVoices().length !== 0) {
                synth.onvoiceschanged = null;
                resolve(synth.getVoices());
            }
        });
    }

    private static async getVoices(): Promise<SpeechSynthesisVoice[]> {
        if (!this.voices) {
            this.voices = await this.populateVoiceList();
        }
        return this.voices;
    }

    public static async stopSpeak(): Promise<void> {
        this.speak(" ");
    }

    public static async speak(textToRead: string): Promise<void> {
        const synth = window.speechSynthesis;

        if (textToRead !== "") {
            const voices = await this.getVoices();
            const utterThis = new SpeechSynthesisUtterance(textToRead);
            utterThis.voice = voices.find(voice => voice.lang === 'ko-KR') || voices[0];
            utterThis.pitch = 1;
            utterThis.rate = 1;

            if (synth.speaking) {
                synth.cancel();
            }

            return new Promise<void>((resolve) => {
                utterThis.onend = () => resolve();
                synth.speak(utterThis);
            });
        }
    }

    public static async isReady(): Promise<boolean> {
        const synth = window.speechSynthesis;

        if (synth.pending || synth.speaking) {
            return false;
        }

        const voices = await this.getVoices();
        return voices.length > 0;
    }
}



/**
 * SpeechInputProvider 클래스는 SpeechRecognition API를 사용하여 음성 인식을 제공합니다.
 */
export class SpeechInputProvider {
    private static recognition: SpeechRecognition | null = null;
    private static timeoutId: number | null = null;
    private static TIMEOUT_DURATION = 5000; // 5 seconds
    private static onAutoStopCallback: (() => void) | null = null;

    private constructor() { }

    private static initializeRecognition(): void {
        const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;      // 연속적인 음성 인식을 사용
            this.recognition.interimResults = false; // 중간 결과를 반환 여부
        } else {
            console.error('Speech recognition not supported in this browser.');
        }
    }

    private static startAutoEnd(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = window.setTimeout(() => {
            this.stopRecognition();
            if (this.onAutoStopCallback) {
                this.onAutoStopCallback();
            }
        }, this.TIMEOUT_DURATION);
    }


    private static removeAutoEnd(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
    }


    public static startRecognition({ onResult, onAutoStop }: { onResult: (result: string) => void, onAutoStop: () => void }): void {
        if (!this.recognition) {
            this.initializeRecognition();
        }
        if (this.recognition) {
            this.onAutoStopCallback = onAutoStop;

            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0])
                    .map(result => result.transcript)
                    .join('');
                onResult(transcript);
            };

            this.recognition.onspeechstart = () => {
                this.removeAutoEnd();
            };

            this.startAutoEnd();
            this.recognition.start();
        }
    }

    public static stopRecognition(): void {
        if (this.timeoutId !== null) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }

        if (this.recognition) {
            this.recognition.stop();
        }
    }
}
