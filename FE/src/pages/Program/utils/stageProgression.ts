import type { TableEnum } from '../Model';

const TRUST_FUND_PROGRAM_TYPE = 3;

export interface StageProgression {
  nextStage: TableEnum | undefined;
  skipStage: TableEnum | undefined;
  isTerminalStage: boolean;
}

// Trust Fund programs (programType === 3) run on their own TF/TF-R stage track,
// separate from the main BP...RDIP/PIP track — see AddProgramDialog's Type===3 handling.
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
  const isTrustFundProgram = programType === TRUST_FUND_PROGRAM_TYPE;
  const track = stages
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
