declare module "google-news-decoder" {
  export interface DecodeResult {
    status: boolean;
    decodedUrl?: string;
    message?: string;
  }

  export default class GoogleNewsDecoder {
    decodeGoogleNewsUrl(url: string): Promise<DecodeResult>;
  }
}
