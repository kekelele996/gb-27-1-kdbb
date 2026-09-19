import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true, namespace: '/chat' })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeUsers = new Map<string, string>();

  handleConnection(client: Socket) {
    const roomId = client.handshake.query.roomId as string;
    const userId = client.handshake.query.userId as string;
    
    if (roomId) {
      client.join(roomId);
      this.activeUsers.set(client.id, userId);
      
      this.server.to(roomId).emit('userJoined', {
        userId,
        clientId: client.id,
      });
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.activeUsers.get(client.id);
    this.activeUsers.delete(client.id);
    
    const rooms = Object.keys(client.rooms);
    rooms.forEach(roomId => {
      if (roomId !== client.id) {
        this.server.to(roomId).emit('userLeft', {
          userId,
          clientId: client.id,
        });
      }
    });
  }

  @SubscribeMessage('sendMessage')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; message: string; userId: string; userName: string },
  ) {
    const { roomId, message, userId, userName } = data;
    
    this.server.to(roomId).emit('message', {
      id: Date.now().toString(),
      userId,
      userName,
      message,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('raiseHand')
  handleRaiseHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; userName: string },
  ) {
    const { roomId, userId, userName } = data;
    
    this.server.to(roomId).emit('handRaised', {
      userId,
      userName,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage('lowerHand')
  handleLowerHand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    const { roomId, userId } = data;
    
    this.server.to(roomId).emit('handLowered', {
      userId,
    });
  }

  @SubscribeMessage('whiteboardDraw')
  handleWhiteboardDraw(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; action: any },
  ) {
    const { roomId, action } = data;
    
    this.server.to(roomId).emit('whiteboardUpdate', action);
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.join(data.roomId);
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    client.leave(data.roomId);
  }
}
