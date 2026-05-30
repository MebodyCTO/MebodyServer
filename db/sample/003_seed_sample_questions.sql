-- 003: 12문항 샘플 시드 (sample_subjective_v1)
-- 001 실행 후 적용

CREATE UNIQUE INDEX IF NOT EXISTS questions_sample_code_set_uidx
  ON public.questions (question_code, question_set);

INSERT INTO public.questions (
  question_code, question_number, sort_order, axis,
  question_text, option_1, option_2, option_3,
  weight_a, weight_b, is_precheck, is_scored, is_active,
  answer_type, question_set, media_type, media_url
) VALUES
  ('1-1', 1, 1, 'neck', '컴퓨터나 스마트폰을 오래 쓰고 나면 어디가 먼저 뻐근해지나요?', '뒷목이나 목 위쪽이 먼저 뻐근해진다', '잘 모르겠다 / 둘 다 비슷하다', '목은 크게 불편하지 않고 등·허리 쪽 피로가 더 먼저 느껴진다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('1-2', 2, 2, 'neck', '주변에서 이런 말을 들어본 적 있나요?', '"목이 앞으로 나왔다" 또는 "자세가 구부정하다"는 말을 들어본 적 있다', '잘 모르겠다', '그런 말을 들어본 적 없고 자세가 바르다는 말을 듣는 편이다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('1-3', 3, 3, 'neck', '평소 내 옆모습을 떠올렸을 때, 머리 위치는 어디에 가까운 것 같나요?', '어깨보다 앞으로 나와 있는 편이다', '잘 모르겠다', '어깨 위에 비교적 잘 올라와 있는 편이다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('2-1', 4, 4, 'shoulder', '거울이나 사진에서 어느 쪽 어깨가 더 올라가 보인다고 느낀 적이 있나요?', '오른쪽 어깨가 더 올라가 보인 적이 많다', '잘 모르겠다 / 양쪽 비슷하다', '왼쪽 어깨가 더 올라가 보인 적이 많다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('2-2', 5, 5, 'shoulder', '일이나 공부 후 어느 쪽 목·어깨가 더 자주 뭉치나요?', '오른쪽이 더 자주, 더 많이 뭉친다', '잘 모르겠다 / 양쪽 비슷하다', '왼쪽이 더 자주, 더 많이 뭉친다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('2-3', 6, 6, 'shoulder', '지금 잠깐 어깨 힘을 느껴보세요. 어느 쪽 어깨가 더 올라가 있거나 긴장된 느낌인가요?', '오른쪽 어깨가 더 올라가 있거나 힘이 들어간 느낌이다', '잘 모르겠다 / 양쪽 비슷하다', '왼쪽 어깨가 더 올라가 있거나 힘이 들어간 느낌이다', 1, 1, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('3-1', 7, 7, 'pelvis', '편하게 서 있을 때, 어느 쪽 다리에 체중을 더 자주 싣는 편인가요?', '오른쪽 다리에 더 자주 기대거나 체중을 싣는다', '잘 모르겠다 / 양쪽 비슷하다', '왼쪽 다리에 더 자주 기대거나 체중을 싣는다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('3-2', 8, 8, 'pelvis', '평소 다리를 꼬고 앉는다면, 어느 쪽 다리를 위로 올리는 게 더 편한가요?', '오른쪽 다리를 위로 올리는 게 편하다', '다리를 잘 안 꼬거나 잘 모르겠다', '왼쪽 다리를 위로 올리는 게 편하다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('3-3', 9, 9, 'pelvis', '바지, 치마, 벨트 라인이 입다 보면 한쪽으로 돌아가는 느낌이 있나요?', '오른쪽으로 돌아가는 느낌이 많다', '거의 없거나 잘 모르겠다', '왼쪽으로 돌아가는 느낌이 많다', 1, 1, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('4-1', 10, 10, 'flexibility', '평소 내 하체는 어느 쪽에 더 가깝다고 느끼나요?', '허벅지 뒤, 종아리, 발목이 전반적으로 뻣뻣한 편이다', '잘 모르겠다', '잘 늘어나는 편이지만, 오래 버티거나 균형 잡는 건 약한 편이다', 3, 3, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('4-2', 11, 11, 'flexibility', '허리를 숙여서 바닥 쪽으로 손을 내려보면 어디까지 가나요?', '손이 바닥에 전혀 닿지 않는다', '손끝이 정강이~발목 근처까지만 간다 / 애매하다', '손이 바닥에 닿는다', 2, 2, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie'),
  ('4-3', 12, 12, 'flexibility', '오래 앉아 있다가 처음 일어설 때 어떤 느낌인가요?', '엉덩이·허벅지·허리가 뻣뻣하거나 무거워서 바로 움직이기 어렵다', '잘 모르겠다 / 그때그때 다르다', '별로 그런 느낌이 없고 비교적 바로 움직여진다', 3, 3, false, true, true, 'single', 'sample_subjective_v1', 'lottie', '/sample/animations/character.lottie')
ON CONFLICT (question_code, question_set) DO UPDATE SET
  question_text = EXCLUDED.question_text,
  option_1 = EXCLUDED.option_1,
  option_2 = EXCLUDED.option_2,
  option_3 = EXCLUDED.option_3,
  weight_a = EXCLUDED.weight_a,
  weight_b = EXCLUDED.weight_b,
  media_type = EXCLUDED.media_type,
  media_url = EXCLUDED.media_url,
  is_active = EXCLUDED.is_active;
