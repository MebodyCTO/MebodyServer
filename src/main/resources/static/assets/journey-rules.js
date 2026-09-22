/**
 * 자동 생성 파일입니다. **직접 고치지 마세요.**
 *
 * 원본: mebody-jjh/src/utils/journeyRules.ts
 * 생성: npm run build:rules   (앱 저장소에서)
 *
 * 규칙을 고칠 일이 있으면 원본을 고치고 다시 생성합니다. 이 파일을 손으로 고치면
 * 앱과 콘솔이 다른 추천을 하게 되고, 112개 테스트는 원본만 지킵니다.
 */
const AXIS_TIE_PRIORITY = {
  neck: 1,
  shoulder: 2,
  pelvis: 3,
  flexibility: 4
};
const AXIS_TO_BODY_PARTS = {
  neck: ["neck"],
  shoulder: ["shoulder", "back"],
  pelvis: ["pelvis", "waist"],
  lower: ["knee", "ankle", "foot"]
};
const DEFAULT_AVAILABLE_MINUTES = 5;
const MIN_EXTRA_MISSION_SEC = 150;
const RESTART_THRESHOLD_DAYS = 3;
const FEEDBACK_WINDOW = 3;
const RECENT_CONTENT_WINDOW = 3;
const KST_OFFSET_MINUTES = 540;
function durationForMissionType(tag, missionType) {
  if (missionType === "combo") return tag.base_duration_sec;
  return Math.max(30, Math.round(tag.base_duration_sec / 2));
}
function buildAxisPriority(axisRows) {
  return [...axisRows].sort((left, right) => {
    if (right.dominantPercent !== left.dominantPercent) {
      return right.dominantPercent - left.dominantPercent;
    }
    return (AXIS_TIE_PRIORITY[right.key] ?? 0) - (AXIS_TIE_PRIORITY[left.key] ?? 0);
  }).map((row, index) => ({
    rank: index + 1,
    axis: row.axisLookupKey,
    direction: row.dominantCode,
    percent: row.dominantPercent,
    label: row.dominantLabel
  }));
}
function computeCurrentDay(startedAt, now = /* @__PURE__ */ new Date(), durationDays = 14) {
  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  if (Number.isNaN(start.getTime())) return 1;
  const toKstDayIndex = (date) => Math.floor((date.getTime() + KST_OFFSET_MINUTES * 6e4) / 864e5);
  const elapsed = toKstDayIndex(now) - toKstDayIndex(start);
  return Math.min(Math.max(elapsed + 1, 1), durationDays);
}
function daysSince(lastActiveAt, now = /* @__PURE__ */ new Date()) {
  if (!lastActiveAt) return 0;
  const last = new Date(lastActiveAt);
  if (Number.isNaN(last.getTime())) return 0;
  const toKstDayIndex = (date) => Math.floor((date.getTime() + KST_OFFSET_MINUTES * 6e4) / 864e5);
  return Math.max(0, toKstDayIndex(now) - toKstDayIndex(last));
}
function getDaySpec(dayPlan, dayNo) {
  return dayPlan?.days?.find((day) => day.day === dayNo) ?? null;
}
function baseDifficultyForDay(dayNo, dayPlan) {
  const table = dayPlan?.base_difficulty;
  if (table) {
    for (const [range, value] of Object.entries(table)) {
      const [fromRaw, toRaw] = range.split("-");
      const from = Number(fromRaw);
      const to = Number(toRaw ?? fromRaw);
      if (Number.isFinite(from) && Number.isFinite(to) && dayNo >= from && dayNo <= to) {
        return clampDifficulty(value);
      }
    }
  }
  if (dayNo <= 4) return 1;
  if (dayNo <= 10) return 2;
  return 3;
}
function clampDifficulty(value) {
  if (!Number.isFinite(value)) return 2;
  return Math.min(3, Math.max(1, Math.round(value)));
}
function summarizeFeedback(records = []) {
  const excludedContentKeys = /* @__PURE__ */ new Set();
  const preferredContentKeys = /* @__PURE__ */ new Set();
  for (const record of records) {
    if (record.feeling === "UNCOMFORTABLE") excludedContentKeys.add(record.content_key);
    if (record.feeling === "BETTER") preferredContentKeys.add(record.content_key);
  }
  for (const key of excludedContentKeys) preferredContentKeys.delete(key);
  const recent = records.slice(0, FEEDBACK_WINDOW);
  const counts = { EASY: 0, GOOD: 0, HARD: 0 };
  for (const record of recent) counts[record.difficulty] += 1;
  let difficultyTrend = "GOOD";
  if (counts.HARD > counts.EASY && counts.HARD >= counts.GOOD) difficultyTrend = "HARD";
  else if (counts.EASY > counts.HARD && counts.EASY >= counts.GOOD) difficultyTrend = "EASY";
  return { excludedContentKeys, preferredContentKeys, difficultyTrend };
}
function adjustDifficulty(base, trend) {
  if (trend === "HARD") return clampDifficulty(base - 1);
  if (trend === "EASY") return clampDifficulty(base + 1);
  return clampDifficulty(base);
}
function scaleDuration(baseSec, trend) {
  const factor = trend === "HARD" ? 0.7 : trend === "EASY" ? 1.2 : 1;
  const scaled = Math.round(baseSec * factor / 30) * 30;
  return Math.max(60, scaled);
}
function scaleSets(trend, baseSets = 3) {
  if (trend === "HARD") return Math.max(1, baseSets - 1);
  if (trend === "EASY") return baseSets + 1;
  return baseSets;
}
function matchesDirection(tag, direction) {
  return tag.direction_key === direction || tag.direction_key === "both";
}
function pickBestTag(pool, targetDifficulty, recentContentKeys, preferred) {
  if (pool.length === 0) return null;
  const recentIndex = new Map(recentContentKeys.map((key, index) => [key, index]));
  return [...pool].sort((left, right) => {
    const byDifficulty = Math.abs(left.difficulty - targetDifficulty) - Math.abs(right.difficulty - targetDifficulty);
    if (byDifficulty !== 0) return byDifficulty;
    const leftRecent = recentIndex.has(left.content_key) ? 1 : 0;
    const rightRecent = recentIndex.has(right.content_key) ? 1 : 0;
    if (leftRecent !== rightRecent) return leftRecent - rightRecent;
    const leftPreferred = preferred.has(left.content_key) ? 0 : 1;
    const rightPreferred = preferred.has(right.content_key) ? 0 : 1;
    if (leftPreferred !== rightPreferred) return leftPreferred - rightPreferred;
    return left.content_key.localeCompare(right.content_key);
  })[0];
}
function buildRestartMission(axis, contentTags, excluded) {
  const pool = contentTags.filter(
    (tag) => tag.is_active && !excluded.has(tag.content_key) && (axis ? tag.axis_key === axis.axis : true)
  );
  const picked = pickBestTag(pool.length ? pool : contentTags.filter((t) => t.is_active), 1, [], /* @__PURE__ */ new Set());
  if (!picked) return [];
  return [
    {
      slot_no: 1,
      content_key: picked.content_key,
      mission_type: "release",
      planned_duration_sec: Math.max(60, Math.round(picked.base_duration_sec / 2)),
      difficulty: 1,
      source_rule: "restart",
      axis_rank: axis?.rank ?? 1
    }
  ];
}
function selectDailyMissions(input) {
  const {
    dayNo,
    dayPlan,
    axisPriority,
    contentTags,
    feedback = [],
    recentContentKeys = [],
    availableMinutes = DEFAULT_AVAILABLE_MINUTES,
    lastActiveAt = null,
    now = /* @__PURE__ */ new Date()
  } = input;
  const summary = summarizeFeedback(feedback);
  const activeTags = contentTags.filter((tag) => tag.is_active);
  if (daysSince(lastActiveAt, now) >= RESTART_THRESHOLD_DAYS) {
    return buildRestartMission(axisPriority[0], activeTags, summary.excludedContentKeys);
  }
  const daySpec = getDaySpec(dayPlan, dayNo);
  if (!daySpec || daySpec.slots.length === 0) return [];
  const baseDifficulty = baseDifficultyForDay(dayNo, dayPlan);
  const targetDifficulty = adjustDifficulty(baseDifficulty, summary.difficultyTrend);
  const recentWindow = recentContentKeys.slice(0, RECENT_CONTENT_WINDOW);
  const planned = [];
  const usedKeys = /* @__PURE__ */ new Set();
  let remainingSec = Math.max(60, availableMinutes * 60);
  for (const slot of daySpec.slots) {
    const axis = axisPriority[slot.axis_rank - 1] ?? axisPriority[0];
    if (!axis) continue;
    let sourceRule = slot.axis_rank === 2 ? "axis_p2" : "axis_p1";
    let pool = activeTags.filter(
      (tag) => tag.axis_key === axis.axis && matchesDirection(tag, axis.direction) && !summary.excludedContentKeys.has(tag.content_key) && !usedKeys.has(tag.content_key)
    );
    if (pool.length === 0) {
      const bodyParts = AXIS_TO_BODY_PARTS[axis.axis] ?? [];
      pool = activeTags.filter(
        (tag) => bodyParts.includes(tag.body_part_key) && !summary.excludedContentKeys.has(tag.content_key) && !usedKeys.has(tag.content_key)
      );
      if (pool.length > 0) sourceRule = "substitute";
    }
    const picked = pickBestTag(pool, targetDifficulty, recentWindow, summary.preferredContentKeys);
    if (!picked) continue;
    const rawDuration = durationForMissionType(picked, slot.mission_type);
    const duration = scaleDuration(rawDuration, summary.difficultyTrend);
    if (duration > remainingSec && planned.length > 0) break;
    planned.push({
      slot_no: slot.slot_no,
      content_key: picked.content_key,
      mission_type: slot.mission_type,
      planned_duration_sec: duration,
      difficulty: targetDifficulty,
      source_rule: sourceRule,
      axis_rank: slot.axis_rank
    });
    usedKeys.add(picked.content_key);
    remainingSec -= duration;
  }
  if (daySpec.kind === "normal" && planned.length > 0) {
    for (const axis of axisPriority) {
      if (remainingSec < MIN_EXTRA_MISSION_SEC) break;
      let pool = activeTags.filter(
        (tag) => tag.axis_key === axis.axis && matchesDirection(tag, axis.direction) && !summary.excludedContentKeys.has(tag.content_key) && !usedKeys.has(tag.content_key)
      );
      if (pool.length === 0) {
        const bodyParts = AXIS_TO_BODY_PARTS[axis.axis] ?? [];
        pool = activeTags.filter(
          (tag) => bodyParts.includes(tag.body_part_key) && !summary.excludedContentKeys.has(tag.content_key) && !usedKeys.has(tag.content_key)
        );
      }
      const picked = pickBestTag(pool, targetDifficulty, recentWindow, summary.preferredContentKeys);
      if (!picked) continue;
      const duration = scaleDuration(
        durationForMissionType(picked, daySpec.slots[0].mission_type),
        summary.difficultyTrend
      );
      if (duration > remainingSec) continue;
      planned.push({
        slot_no: planned.length + 1,
        content_key: picked.content_key,
        mission_type: daySpec.slots[0].mission_type,
        planned_duration_sec: duration,
        difficulty: targetDifficulty,
        source_rule: "extra_time",
        axis_rank: axisPriority.indexOf(axis) + 1
      });
      usedKeys.add(picked.content_key);
      remainingSec -= duration;
    }
  }
  return planned;
}
function splitInstructionLines(text) {
  return text.split(/\s+\/\s+/).map((step) => step.trim().replace(/^\d+\.\s*/, "")).filter(Boolean);
}
function buildMissionSteps(content, mission) {
  const releaseSec = content.release_duration_sec ?? 90;
  const stretchSec = content.stretch_duration_sec ?? 30;
  const sets = Math.max(1, content.sets ?? 3);
  const includeRelease = mission.mission_type !== "stretch";
  const includeStretch = mission.mission_type !== "release";
  const naturalTotal = (includeRelease ? releaseSec : 0) + (includeStretch ? stretchSec * sets : 0);
  const rawScale = naturalTotal > 0 ? mission.planned_duration_sec / naturalTotal : 1;
  const scale = Math.min(1.5, Math.max(0.5, rawScale));
  const scaled = (seconds) => Math.max(10, Math.round(seconds * scale / 5) * 5);
  const steps = [];
  if (includeRelease) {
    steps.push({
      key: "release",
      kind: "release",
      title: content.release_title || "\uC774\uC644",
      meta: content.release_tool || "\uB9E8\uC190",
      seconds: scaled(releaseSec),
      lines: splitInstructionLines(content.release_content || "")
    });
  }
  if (includeStretch) {
    for (let index = 0; index < sets; index += 1) {
      steps.push({
        key: `stretch-${index}`,
        kind: "stretch",
        title: content.stretch_title || "\uC2A4\uD2B8\uB808\uCE6D",
        meta: `${index + 1}\uC138\uD2B8 / ${sets}\uC138\uD2B8`,
        seconds: scaled(stretchSec),
        lines: splitInstructionLines(content.stretch_content || ""),
        setIndex: index + 1,
        setTotal: sets
      });
    }
  }
  return steps;
}
function recommendNextJourney(payload) {
  const rate = payload.completion?.rate ?? 0;
  const uncomfortable = payload.feeling?.UNCOMFORTABLE ?? 0;
  const easy = payload.difficulty?.EASY ?? 0;
  const hard = payload.difficulty?.HARD ?? 0;
  if (rate < 40) {
    return {
      kind: "restart_gentle",
      title: "\uAC19\uC740 \uB8E8\uD2F4\uC744 \uB354 \uAC00\uBCCD\uAC8C \uD55C \uBC88 \uB354",
      reason: "\uC774\uBC88 2\uC8FC\uB294 \uC218\uD589 \uD69F\uC218\uAC00 \uB9CE\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. \uD558\uB8E8 \uD55C \uAC00\uC9C0\uB9CC \uB354 \uC9E7\uAC8C \uC774\uC5B4\uAC00 \uBCF4\uC138\uC694.",
      focusRank: 1
    };
  }
  if (uncomfortable > 0) {
    return {
      kind: "remeasure",
      title: "\uC7AC\uCE21\uC815\uC73C\uB85C \uC9C0\uAE08 \uC0C1\uD0DC \uB2E4\uC2DC \uD655\uC778\uD558\uAE30",
      reason: "\uBD88\uD3B8\uD588\uB358 \uB3D9\uC791\uC774 \uC788\uC5C8\uC2B5\uB2C8\uB2E4. 32\uBB38\uD56D\uC744 \uB2E4\uC2DC \uCCB4\uD06C\uD574 \uD604\uC7AC \uAE30\uC900\uC73C\uB85C \uC6B0\uC120\uC21C\uC704\uB97C \uC0C8\uB85C \uC7A1\uB294 \uAC83\uC774 \uC548\uC804\uD569\uB2C8\uB2E4.",
      focusRank: 1
    };
  }
  if (rate >= 70 && easy > hard) {
    return {
      kind: "next_axis",
      title: "2\uC21C\uC704 \uCD95\uC73C\uB85C \uB118\uC5B4\uAC00\uAE30",
      reason: "\uC218\uD589\uB960\uC774 \uB192\uACE0 \uAC15\uB3C4\uB3C4 \uC5EC\uC720\uAC00 \uC788\uC5C8\uC2B5\uB2C8\uB2E4. \uB2E4\uC74C 2\uC8FC\uB294 \uB450 \uBC88\uC9F8 \uCD95\uC744 \uC911\uC2EC\uC73C\uB85C \uC9C4\uD589\uD574 \uBCF4\uC138\uC694.",
      focusRank: 2
    };
  }
  return {
    kind: "remeasure",
    title: "\uB2E4\uC2DC \uCCB4\uD06C\uD558\uACE0 \uB2E4\uC74C \uB8E8\uD2F4 \uC774\uC5B4\uAC00\uAE30",
    reason: "2\uC8FC \uB3D9\uC548\uC758 \uBCC0\uD654\uB97C 32\uBB38\uD56D\uC73C\uB85C \uD655\uC778\uD55C \uB4A4 \uC0C8 \uC6B0\uC120\uC21C\uC704\uB85C \uC774\uC5B4\uAC00\uB294 \uAC83\uC744 \uCD94\uCC9C\uD569\uB2C8\uB2E4.",
    focusRank: 1
  };
}
function reportRangeFor(reportType, dayNo) {
  return { fromDay: 1, toDay: Math.max(1, dayNo) };
}
function buildReportPayload(missions, feedback, contentTags, fromDay, toDay) {
  const inRange = missions.filter((m) => m.day_no >= fromDay && m.day_no <= toDay);
  const completed = inRange.filter((m) => m.status === "completed").length;
  const skipped = inRange.filter((m) => m.status === "skipped").length;
  const rate = inRange.length > 0 ? Math.round(completed / inRange.length * 100) : 0;
  const feeling = { BETTER: 0, SAME: 0, UNCOMFORTABLE: 0 };
  const difficulty = { EASY: 0, GOOD: 0, HARD: 0 };
  for (const record of feedback) {
    feeling[record.feeling] += 1;
    difficulty[record.difficulty] += 1;
  }
  const tagByKey = new Map(contentTags.map((tag) => [tag.content_key, tag]));
  const axisFocus = {};
  for (const mission of inRange) {
    const tag = tagByKey.get(mission.content_key);
    const key = tag?.axis_key ?? tag?.body_part_key ?? "unknown";
    axisFocus[key] = (axisFocus[key] ?? 0) + 1;
  }
  const summary = summarizeFeedback(feedback);
  const nextHint = summary.difficultyTrend === "HARD" ? "\uB2E4\uC74C \uC8FC\uB294 \uC2DC\uAC04\uACFC \uC138\uD2B8\uB97C \uC904\uC5EC \uBD80\uB2F4\uC744 \uB0AE\uCDA5\uB2C8\uB2E4." : summary.difficultyTrend === "EASY" ? "\uB2E4\uC74C \uC8FC\uB294 \uC2DC\uAC04\uACFC \uC138\uD2B8\uB97C \uC870\uAE08 \uB298\uB9BD\uB2C8\uB2E4." : rate < 50 ? "\uB2E4\uC74C \uC8FC\uB294 \uD558\uB8E8 \uD55C \uAC00\uC9C0\uB9CC \uC9E7\uAC8C \uC774\uC5B4\uAC00 \uBCF4\uC138\uC694." : "\uC9C0\uAE08 \uAC15\uB3C4\uB97C \uC720\uC9C0\uD569\uB2C8\uB2E4.";
  return {
    period: { from_day: fromDay, to_day: toDay },
    completion: { scheduled: inRange.length, completed, skipped, rate },
    feeling,
    difficulty,
    axis_focus: axisFocus,
    excluded_content_keys: [...summary.excludedContentKeys],
    next_hint: nextHint
  };
}
export {
  adjustDifficulty,
  baseDifficultyForDay,
  buildAxisPriority,
  buildMissionSteps,
  buildReportPayload,
  computeCurrentDay,
  daysSince,
  durationForMissionType,
  getDaySpec,
  recommendNextJourney,
  reportRangeFor,
  scaleDuration,
  scaleSets,
  selectDailyMissions,
  summarizeFeedback
};
