export class PresenceUserEntity {
  constructor(
    readonly socketId: string,
    readonly userId: string,
    readonly displayName: string,
    readonly joinedAt: string,
  ) {}
}
