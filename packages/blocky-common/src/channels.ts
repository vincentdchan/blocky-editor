

export interface TileChangedMessage {
  type: "tile-changed",
  tileId: string,
}

export type MessageType = TileChangedMessage
