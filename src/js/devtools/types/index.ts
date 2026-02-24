export type ErrorEntry = {
  id: string;
  timestamp: number;
  type: 'error' | 'debug';
  html: string;
  exception?: {
    class: string;
    message: string;
    file: string;
    line: number;
  };
  read: boolean;
};
