import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * Live updates for an attendance session. The lecturer's device joins
 * `session:<id>` when it opens the live QR screen; every new attendance
 * record (see AttendanceService.markAttendance) and every status change
 * (pause/resume/end) is broadcast to that room so the "Present: X / Y"
 * counter and recent-scans list update without polling.
 *
 * The QR token itself is still fetched via GET /sessions/:id/qr — the
 * mobile app already polls on a countdown, so pushing it over the socket
 * too would be redundant.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/sessions' })
export class SessionsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SessionsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('session:join')
  handleJoin(client: Socket, sessionId: string) {
    client.join(this.roomName(sessionId));
  }

  @SubscribeMessage('session:leave')
  handleLeave(client: Socket, sessionId: string) {
    client.leave(this.roomName(sessionId));
  }

  emitAttendanceUpdate(
    sessionId: string,
    payload: { presentCount: number; totalStudents: number; latestStudentName?: string },
  ) {
    this.server.to(this.roomName(sessionId)).emit('attendance:new', payload);
  }

  emitStatusChange(sessionId: string, status: string) {
    this.server.to(this.roomName(sessionId)).emit('session:status', { status });
  }

  private roomName(sessionId: string): string {
    return `session:${sessionId}`;
  }
}
