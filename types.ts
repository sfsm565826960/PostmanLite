export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export interface KeyValue {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface FormDataItem extends KeyValue {
  type: 'text' | 'file';
  file?: File | null;
}

export interface RequestState {
  id: string; // Unique ID for history
  method: HttpMethod;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  
  // Body Configuration
  bodyType: 'none' | 'json' | 'text' | 'file' | 'form-data' | 'x-www-form-urlencoded';
  bodyContent: string; // For JSON/Text
  file: File | null; // For Binary File (single file)
  bodyFormData: FormDataItem[]; // For multipart/form-data
  bodyFormUrlEncoded: KeyValue[]; // For application/x-www-form-urlencoded
  
  // Options
  stream: boolean; // Enable streaming mode
}

export interface ResponseState {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  size: string;
  time: number; // in ms
  contentType: string;
  isError: boolean;
  errorMessage?: string;
}

export interface HistoryItem extends RequestState {
  timestamp: number;
  pinned?: boolean;
}

export interface AppSettings {
  fetchMode: 'cors' | 'no-cors' | 'same-origin';
  fetchCredentials: 'omit' | 'same-origin' | 'include';
  globalHeaders: KeyValue[];

  // Cloud Docs Mode
  cloudDocsMode?: boolean;
  cloudDocsAppId?: string;
  cloudDocsSecureKey?: string;
}
