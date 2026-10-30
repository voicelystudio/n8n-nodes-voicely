import { VersionedNodeType } from "n8n-workflow";
import { VoicelyV1 } from "./v1/VoicelyV1.node";
import { VoicelyV2 } from "./v2/VoicelyV2.node";

export class Voicely extends VersionedNodeType {
  constructor() {
    super(
      { 1: new VoicelyV1(), 2: new VoicelyV2() },
      {
        displayName: "Voicely Studio",
        name: "voicely",
        icon: { light: "file:voicely.svg", dark: "file:voicely.svg" },
        group: ["transform"],
        description: "Speech, transcription and owned voices with Voicely",
        defaultVersion: 2,
        usableAsTool: true,
      },
    );
  }
}
