import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';

const DEFAULT_HUB = 'default';

class SignalRService {
  private connections: Map<string, HubConnection> = new Map();

  async startConnection(url: string, hub: string = DEFAULT_HUB): Promise<void> {
    const connection = new HubConnectionBuilder()
      .withUrl(url, {
        withCredentials: true
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Information)
      .build();

    this.connections.set(hub, connection);

    try {
      await connection.start();
      // console.log(`SignalR Connected: ${hub}`);
    } catch (error) {
      console.error(`SignalR Connection Error (${hub}):`, error);
    }
  }

  async stopConnection(hub: string = DEFAULT_HUB): Promise<void> {
    const connection = this.connections.get(hub);
    if (connection) {
      await connection.stop();
      this.connections.delete(hub);
    }
  }

  on(methodName: string, callback: (...args: any[]) => void, hub: string = DEFAULT_HUB): void {
    this.connections.get(hub)?.on(methodName, callback);
  }

  off(methodName: string, callback?: (...args: any[]) => void, hub: string = DEFAULT_HUB): void {
    const connection = this.connections.get(hub);
    if (!connection) return;
    if (callback) {
      connection.off(methodName, callback);
    } else {
      connection.off(methodName);
    }
  }

  async invoke(methodName: string, ...args: any[]): Promise<any> {
    return this.invokeOn(DEFAULT_HUB, methodName, ...args);
  }

  async invokeOn(hub: string, methodName: string, ...args: any[]): Promise<any> {
    const connection = this.connections.get(hub);
    if (!connection) {
      throw new Error(`SignalR connection "${hub}" is not established`);
    }
    return await connection.invoke(methodName, ...args);
  }

  getConnectionState(hub: string = DEFAULT_HUB): string {
    return this.connections.get(hub)?.state || 'Disconnected';
  }

  isConnected(hub: string = DEFAULT_HUB): boolean {
    return this.connections.get(hub)?.state === 'Connected';
  }

  onReconnected(callback: (connectionId: string | undefined) => void, hub: string = DEFAULT_HUB): void {
    this.connections.get(hub)?.onreconnected(callback);
  }
}

export const signalRService = new SignalRService();
