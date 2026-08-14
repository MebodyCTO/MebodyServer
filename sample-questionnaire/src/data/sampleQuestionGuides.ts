import type { SampleQuestion } from './sampleQuestionsSnapshot'

export type QuestionPhase = 'select' | 'guide'

export interface QuestionGuideContent {
  guideText: string
}

const GUIDE_TEXT_BY_NUMBER: Record<number, string> = {
  1: '스마트폰·컴퓨터 사용 후 어디가 먼저 뻐근한지 떠올려 보세요. 목과 등·허리 중 어디가 먼저 피로해지는지가 목 방향(F/C)을 잡는 첫 단서예요.',
  2: '주변에서 들었던 자세 관련 말을 떠올려 보세요. "목이 앞으로 나왔다"는 피드백은 목 전방(F) 경향과 연결될 수 있어요.',
  3: '옆모습에서 머리 위치를 상상해 보세요. 어깨보다 앞으로 나와 있으면 목 전방(F), 어깨 위에 잘 올라와 있으면 중립(C)에 가깝습니다.',
  4: '거울이나 사진 속 어깨 높이를 떠올려 보세요. 한쪽이 더 올라가 보였다면 어깨 높이(R/L) 경향을 잡는 단서가 됩니다.',
  5: '일·공부 후 어느 쪽이 더 뭉치는지 떠올려 보세요. 자주 뭉치는 쪽 어깨가 상대적으로 높게 작용하는 패턴과 연결될 수 있어요.',
  6: '지금 잠깐 어깨에 힘을 넣어 느껴 보세요. 한쪽이 더 올라가 있거나 긴장되면 그 방향이 어깨 축 단서가 됩니다.',
  7: '편하게 서 있을 때 어느 다리에 체중을 더 싣는지 떠올려 보세요. 체중이 실리는 쪽과 골반 회전(R/L) 경향이 연결될 수 있어요.',
  8: '평소 다리를 꼬고 앉을 때 어느 쪽이 위로 가는지 떠올려 보세요. 더 편한 쪽이 골반 회전 방향 단서가 될 수 있습니다.',
  9: '바지·치마·벨트 라인이 한쪽으로 돌아가는 느낌이 있었는지 떠올려 보세요. 골반 회전(R/L)을 확인하는 생활 속 단서예요.',
  10: '평소 하체가 뻣뻣한지, 유연한지 떠올려 보세요. 뻣뻣함(S)과 유연함(F) 중 어디에 가까운지가 하체 축의 출발점입니다.',
  11: '허리를 숙여 손이 어디까지 가는지 상상해 보세요. 바닥에 닿는지, 정강이 근처인지에 따라 하체 유연성(S/F) 단서가 달라집니다.',
  12: '오래 앉았다가 일어설 때 뻣뻣함이나 무거움이 느껴지는지 떠올려 보세요. 그 느낌은 하체 뻣뻣함(S) 경향과 연결될 수 있어요.',
}

const TOTAL_GUIDE_QUESTIONS = 12

export function isGuideStepEnabled(questionNumber: number): boolean {
  return questionNumber >= 1 && questionNumber <= TOTAL_GUIDE_QUESTIONS
}

export function getQuestionGuideContent(question: SampleQuestion): QuestionGuideContent {
  return {
    guideText:
      GUIDE_TEXT_BY_NUMBER[question.question_number] ??
      '선택하신 답을 바탕으로 움직임 경향을 확인하고 있어요. 다음으로 넘어가기 전에 한 번 더 떠올려 보세요.',
  }
}
