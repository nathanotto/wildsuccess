// Real-shape data matching Nathan's actual Today screenshot.
// Pulled from the screenshot + the code in components/today/TodayPage.tsx.

window.TODAY_DATA = {
  weekIntent:
    "Health: max one drink M-Thu, 3x aerobic exercise x20 min. Out of town for the weekend — pack early, leave on time.",
  nextUp: { name: "Meet with Casey Google Meet", time: "14:00" },
  nowTime: "11:16",
  stats: { done: 4, scheduled: 3, todo: 11 },
  scheduled: [
    { id: "s1", time: "06:30", name: "Tea, Yoga & Morning Reflection", status: "completed", time_type: "D", emotional_weight: "normal" },
    { id: "s2", time: "08:00", name: "Collect well water",            status: "completed", time_type: "B", emotional_weight: "normal" },
    { id: "s3", time: "10:00", name: "Ibrahim call",                  status: "completed", time_type: "C", emotional_weight: "normal", hasPlan: true },
    { id: "s4", time: "14:00", name: "Meet with Casey Google Meet",   status: "committed", time_type: "C", emotional_weight: "normal" },
    { id: "s5", time: "18:30", name: "Erin gets home",                status: "committed", time_type: "C", emotional_weight: "normal" },
    { id: "s6", time: "20:45", name: "Wind-down routine",             status: "committed", time_type: "D", emotional_weight: "normal" },
  ],
  todo: [
    { id: "t1", name: "Get wire history from Colin at Chase",                                status: "committed", time_type: "B", capturedAgo: 0 },
    { id: "t2", name: "Follow up with Eric Singer's RNG guy",                                status: "committed", time_type: "C", capturedAgo: 1, hasPlan: true },
    { id: "t3", name: "Schedule and talk to Traver about PUNC model",                        status: "committed", time_type: "C", capturedAgo: 2, hasPlan: true },
    { id: "t4", name: "Sign up and pay for Skip Barber racing",                              status: "committed", time_type: "B", capturedAgo: 3, hasPlan: true },
    { id: "t5", name: "Check in with Erin that her account is set up and she can see it",    status: "committed", time_type: "C", capturedAgo: 0 },
    { id: "t6", name: "Ideas for Wild Success",                                              status: "committed", time_type: "A", capturedAgo: 5, hasPlan: true },
    { id: "t7", name: "Send onto government report to Joe Sheehey",                          status: "committed", time_type: "B", capturedAgo: 1 },
    { id: "t8", name: "Write up a will for Nathan that includes Garden Lane being left to Erin.", status: "committed", time_type: "A", capturedAgo: 4, hasPlan: true, emotional_weight: "heavy" },
    { id: "t9", name: "Look at PCV balance sheet",                                           status: "completed", time_type: "B", capturedAgo: 0, hasPlan: true },
    { id: "t10", name: "Visit the DMV and ask about my license plate stickers",              status: "committed", time_type: "B", capturedAgo: 6, hasPlan: true },
    { id: "t11", name: "Complete commitment to Jan to organize wedding event contracts",     status: "committed", time_type: "C", capturedAgo: 2, hasPlan: true },
    { id: "t12", name: "Reach out to Bryan Franklin",                                        status: "committed", time_type: "C", capturedAgo: 1 },
  ],
  thisWeek: [
    { id: "w1", name: "Follow up with Susan on PCR payback schedule" },
    { id: "w2", name: "Note to self: program a way to close the day at the end of the day" },
    { id: "w3", name: "On reminder to check if AF has finished her parenting course" },
  ],
  lookingForwardCount: 14,
};
