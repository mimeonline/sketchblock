import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateSessionStateDto {
  @ApiProperty({ type: Object, description: "Complete Excalidraw snapshot content for the session." })
  content!: unknown;

  @ApiProperty({ type: String, example: "web-api" })
  updatedBy!: string;

  @ApiPropertyOptional({ type: Number, example: 1 })
  baseRevision?: number;
}

export class RegisterSessionDto {
  @ApiProperty({ type: String, example: "demo-session" })
  sessionId!: string;

  @ApiProperty({ type: String, example: "web-api" })
  userId!: string;

  @ApiPropertyOptional({ type: String, example: "Sketchblock Web" })
  displayName?: string;

  @ApiPropertyOptional({ type: String, example: "examples/drawings/sketchblock-session-example.excalidraw" })
  drawingPath?: string;

  @ApiPropertyOptional({ type: Object, description: "Initial Excalidraw file content." })
  initialContent?: unknown;
}

export class UpdateSessionStatusDto {
  @ApiProperty({ type: String, enum: ["active", "closed", "saved"], example: "saved" })
  status!: "active" | "closed" | "saved";

  @ApiProperty({ type: String, example: "web-api" })
  updatedBy!: string;
}

export class CloseSessionDto {
  @ApiProperty({ type: String, example: "web-api" })
  closedBy!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: Boolean, example: false })
  ok!: false;

  @ApiProperty({ type: String, example: "not_authorized" })
  error!: string;
}
