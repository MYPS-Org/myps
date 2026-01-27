import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

class SignalRService {
  private connection: HubConnection | null = null;

  async startConnection(url: string): Promise<void> {
    this.connection = new HubConnectionBuilder()
      .withUrl(url, {
        withCredentials: true
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    try {
      await this.connection.start();
      // console.log('SignalR Connected');
    } catch (error) {
      console.error('SignalR Connection Error:', error);
    }
  }

  async stopConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
    }
  }

  on(methodName: string, callback: (...args: any[]) => void): void {
    if (this.connection) {
      this.connection.on(methodName, callback);
    }
  }

  off(methodName: string, callback?: (...args: any[]) => void): void {
    if (this.connection) {
      if (callback) {
        this.connection.off(methodName, callback);
      } else {
        this.connection.off(methodName);
      }
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<any> {
    if (this.connection) {
      return await this.connection.invoke(methodName, ...args);
    }
    throw new Error('SignalR connection is not established');
  }

  getConnectionState(): string {
    return this.connection?.state || 'Disconnected';
  }

  isConnected(): boolean {
    return this.connection?.state === 'Connected';
  }
}

export const signalRService = new SignalRService();
