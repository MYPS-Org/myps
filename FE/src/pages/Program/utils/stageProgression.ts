import type { TableEnum } from '../Model';

const TRUST_FUND_PROGRAM_TYPE = 3;

// RBP/RDIP/PIP are standalone stages, not a chain a program "proceeds" through —
// a program at any of these (e.g. created directly at RBP) never offers a "Proceed
// to next stage" button, and a Main-track program at GAA-R never offers "Proceed to
// RBP" either. They're excluded from the main track entirely so GAA-R stays terminal,
// and treated as individually terminal (no next stage) when reached themselves.
const STANDALONE_STAGE_IDS = [8, 9, 11]; // RBP, RDIP, PIP

export interface StageProgression {
  nextStage: TableEnum | undefined;
  skipStage: TableEnum | undefined;
  isTerminalStage: boolean;
}

// Trust Fund programs (programType === 3) run on their own TF/TF-R stage track,
// separate from the main BP...GAA-R track — see AddProgramDialog's Type===3 handling.
const isTrustFundStage = (stage: TableEnum) => stage.Name.startsWith('TF');

export function getStageProgression(
  stages: TableEnum[],
  // Details.StageId is persisted server-side as the stage's NameId (see
  // ProgramController.UpdateProgramStage: `StageId = dto.Stage`, where dto.Stage
  // is validated against `tOptionProgramStage.NameId`) — NOT the tOptionProgramStage.Id
  // identity column. Track/match on NameId to stay correct even if Id and NameId
  // ever diverge (they happen to be numerically identical in current seed data).
  currentStageNameId: number,
  programType: number
): StageProgression {
  if (STANDALONE_STAGE_IDS.includes(currentStageNameId)) {
    return { nextStage: undefined, skipStage: undefined, isTerminalStage: true };
  }

  const isTrustFundProgram = programType === TRUST_FUND_PROGRAM_TYPE;
  const track = stages
    .filter(stage => !STANDALONE_STAGE_IDS.includes(stage.NameId))
    .filter(stage => isTrustFundStage(stage) === isTrustFundProgram)
    .sort((a, b) => a.NameId - b.NameId);

  const currentIndex = track.findIndex(stage => stage.NameId === currentStageNameId);
  const nextStage = currentIndex === -1 ? undefined : track[currentIndex + 1];
  const skipStage = currentIndex === -1 ? undefined : track[currentIndex + 2];

  return {
    nextStage,
    skipStage,
    isTerminalStage: !nextStage,
  };
}
