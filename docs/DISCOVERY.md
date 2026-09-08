# Original repository discovery

The active router is src/routes/index.tsx, imported by App.tsx. AppRouter.tsx is an unused older router.

## File responsibility and feature inventory

| File | Responsibility / exported features | Data entities |
|---|---|---|
| `.env.example` | server/tooling/schema |  |
| `.gitignore` | server/tooling/schema |  |
| `.oxlintrc.json` | server/tooling/schema |  |
| `index.html` | server/tooling/schema |  |
| `package.json` | server/tooling/schema |  |
| `README.md` | server/tooling/schema |  |
| `scripts/backup.mjs` | server/tooling/schema |  |
| `scripts/fix-pages.cjs` | server/tooling/schema |  |
| `scripts/restructure.py` | server/tooling/schema |  |
| `server/.env.example` | server/tooling/schema |  |
| `server/MIGRATION.md` | server/tooling/schema |  |
| `server/package.json` | server/tooling/schema |  |
| `server/scripts/export-supabase.mjs` | server/tooling/schema |  |
| `server/scripts/import-mongo.mjs` | server/tooling/schema | app_settings, auth_users, profiles |
| `server/scripts/seed-teachers.mjs` | server/tooling/schema | auth_users, profiles |
| `server/scripts/set-passwords.mjs` | server/tooling/schema | auth_users, profiles |
| `server/scripts/smoke-e2e.mjs` | server/tooling/schema |  |
| `server/scripts/verify.mjs` | server/tooling/schema | auth_users, profiles, students, teachers |
| `server/src/auth.ts` | profileEmail, issueAccessToken, verifyAccessToken, AuthSession, createSession, refreshSession, revokeSession, revokeAllSessions, AuthUserResponse, authUser, signInWithPassword, updatePassword | auth_sessions, auth_users |
| `server/src/backup.ts` | BackupResult, performBackup, runScheduledBackupIfDue, runCheckTeacherAbsence, isCronSecret, cronSecretStatus, unavailable | app_settings, auth_users, backup_logs, backups, notifications, profiles, teacher_attendance, teacher_leave, teachers |
| `server/src/config.ts` | config |  |
| `server/src/db.ts` | connectDb, closeDb, getDb, collection, TABLES, TableName, BUSINESS_TABLES, NON_BACKUP_TABLES |  |
| `server/src/engine.ts` | RestFilter, RestRequest, RestResult, parseSelect, resetCascadeState, runQuery, upsertRows |  |
| `server/src/errors.ts` | ApiError |  |
| `server/src/index.ts` | server/tooling/schema |  |
| `server/src/policy.ts` | PolicyResult, PolicyResolver, TABLE_POLICIES |  |
| `server/src/realtime.ts` | RealtimeSocket, ConnectionInfo, registerSocket, getConnection, setTopics, addTopics, removeTopic, closeSocket, emit, emitToUser, emitToConv, emitNotification, connectionCount, broadcastToAll, relayToOthers, handleIncoming |  |
| `server/src/relationships.ts` | ResolvedEmbed, resolveEmbed |  |
| `server/src/restore.ts` | restoreFromSnapshot |  |
| `server/src/routes.ts` | registerRoutes | audit_logs, auth_users, backups, profiles, students, teacher_classes, teachers |
| `server/src/rpc.ts` | runRpc | audit_logs, auth_users, backup_logs, backups, classes, finance_records, profiles, student_parents, students, teacher_leave, teachers |
| `server/src/schema.ts` | applyInsertDefaults, touchUpdatedAt, hasColumn, DELETE_CASCADES, DELETE_SET_NULL |  |
| `server/src/security.ts` | ProfileDoc, STAFF_NOTIFY_ROLES, RequestContext, RowPredicate, activeStatusFilter, eqRows, normalizeDateString | chat_participants, committee_classes, committee_member_classes, committee_members, profiles, student_parents, students, teacher_classes, teachers |
| `server/src/storage.ts` | bucketDir, ensureBucket, uploadFile, streamUpload, readFile, openReadStream, removeFiles, deleteBackupFile, createSignedUrl, publicUrl, verifySigned, sha256HexData |  |
| `server/src/trigger.ts` | notifyUser, validateInsert, validateUpdate, afterInsert, afterUpdate, afterDelete | activity_logs, chat_posts, notifications, profiles |
| `server/src/util.ts` | uuid, sha256, hashToken, nowIso, isInvalidDate, hashPassword, verifyPassword, randomPassword, nextPaddedId, parseXorFilter |  |
| `server/tsconfig.json` | server/tooling/schema |  |
| `src/App.tsx` | UI/configuration |  |
| `src/components/ErrorBoundary.tsx` | ErrorBoundary |  |
| `src/components/shared/ConfirmDialog.tsx` | ConfirmDialog |  |
| `src/components/shared/PageHeader.tsx` | PageHeader |  |
| `src/components/shared/StatusBadge.tsx` | StatusBadge |  |
| `src/components/ui/BrandLogo.tsx` | BrandLogo |  |
| `src/components/ui/Button.tsx` | Button |  |
| `src/components/ui/Card.tsx` | Card, StatCard |  |
| `src/components/ui/EmptyState.tsx` | EmptyState |  |
| `src/components/ui/Input.tsx` | Input |  |
| `src/components/ui/Modal.tsx` | Modal |  |
| `src/components/ui/PageLoader.tsx` | PageLoader |  |
| `src/components/ui/Select.tsx` | Select |  |
| `src/components/ui/SimplePage.tsx` | SimplePage |  |
| `src/components/ui/Skeleton.tsx` | Skeleton, TableSkeleton |  |
| `src/features/ai/lexicon.ts` | LexEntry, SOMALI_ENGLISH_LEXICON, ENGLISH_SOMALI_LEXICON, lookupLexical |  |
| `src/features/ai/translator.ts` | LocalWordMeaning, LocalTranslation, translateLocal |  |
| `src/index.css` | UI/configuration |  |
| `src/layouts/AttendanceManagerLayout.tsx` | AttendanceManagerLayout |  |
| `src/layouts/CabaasLayout.tsx` | CabaasLayout |  |
| `src/layouts/CommitteeLayout.tsx` | CommitteeLayout |  |
| `src/layouts/DashboardLayout.tsx` | NavItem, DashboardLayout |  |
| `src/layouts/FinanceLayout.tsx` | FinanceLayout |  |
| `src/layouts/FinanceManagerLayout.tsx` | FinanceManagerLayout |  |
| `src/layouts/ManagerLayout.tsx` | ManagerLayout |  |
| `src/layouts/ParentLayout.tsx` | ParentLayout |  |
| `src/layouts/PracticeLayout.tsx` | PracticeLayout |  |
| `src/layouts/PracticeTeacherLayout.tsx` | PracticeTeacherLayout |  |
| `src/layouts/PublicLayout.tsx` | PublicLayout |  |
| `src/layouts/StaffLayouts.tsx` | FinanceLayout, FinanceManagerLayout, CommitteeLayout, AttendanceManagerLayout |  |
| `src/layouts/StudentLayout.tsx` | StudentLayout |  |
| `src/layouts/SupervisorLayout.tsx` | SupervisorLayout |  |
| `src/layouts/TeacherLayout.tsx` | TeacherLayout |  |
| `src/lib/mongoClient.ts` | createMongoClient |  |
| `src/lib/supabase.ts` | supabase, setRememberMePreference, loginIdToEmail |  |
| `src/lib/utils.ts` | cn, formatDate, formatDateTime, attendancePercent, monthName, getErrorMessage, initials |  |
| `src/main.tsx` | UI/configuration |  |
| `src/pages/auth/ForgotPasswordPage.tsx` | ForgotPasswordPage | password_reset_requests |
| `src/pages/auth/LoginPage.tsx` | LoginPage | profiles |
| `src/pages/cabaas/AttendancePages.tsx` | CabaasTeacherAttendancePage, CabaasStudentAttendancePage, AttendanceManagerStudentPage, AttendanceManagerOverviewPage, AttendanceManagerTeacherPage |  |
| `src/pages/cabaas/OverviewPage.tsx` | CabaasOverviewPage |  |
| `src/pages/cabaas/ResultsReviewPage.tsx` | CabaasResultsReviewPage |  |
| `src/pages/committee/CommitteePages.tsx` | CommitteeOverviewPage, CommitteeActivityAttendancePage |  |
| `src/pages/finance/FinancePages.tsx` | FinanceOverviewPage, FinancePaymentsPage, FinanceManagerOverviewPage, FinanceManagerReportsPage |  |
| `src/pages/manager/AcademicYearsPage.tsx` | ManagerAcademicYearsPage |  |
| `src/pages/manager/AttendancePage.tsx` | ManagerAttendancePage |  |
| `src/pages/manager/AuditLogsPage.tsx` | ManagerAuditLogsPage |  |
| `src/pages/manager/BackupPage.tsx` | ManagerBackupPage |  |
| `src/pages/manager/ClassesPage.tsx` | ManagerClassesPage |  |
| `src/pages/manager/DataImportPage.tsx` | ManagerDataImportPage |  |
| `src/pages/manager/FinancePage.tsx` | ManagerFinancePage |  |
| `src/pages/manager/LeaveAndResetsPage.tsx` | ManagerLeavePage, ManagerPasswordResetsPage | password_reset_requests |
| `src/pages/manager/NoticesPage.tsx` | ManagerNoticesPage |  |
| `src/pages/manager/OutsideActivitiesPage.tsx` | ManagerOutsideActivitiesPage |  |
| `src/pages/manager/OutsideActivityCommitteePage.tsx` | ManagerOutsideActivityCommitteePage |  |
| `src/pages/manager/OverviewPage.tsx` | ManagerOverviewPage |  |
| `src/pages/manager/ParentsPage.tsx` | ManagerParentsPage |  |
| `src/pages/manager/ResultsPage.tsx` | ManagerResultsPage |  |
| `src/pages/manager/SettingsPage.tsx` | SettingsPage, ManagerSettingsPage, StudentSettingsPage |  |
| `src/pages/manager/StudentProfilePage.tsx` | ManagerStudentProfilePage | attendance, profiles, results, student_behavior, students |
| `src/pages/manager/StudentsPage.tsx` | ManagerStudentsPage |  |
| `src/pages/manager/SubjectsPage.tsx` | ManagerSubjectsPage |  |
| `src/pages/manager/TeachersPage.tsx` | ManagerTeachersPage |  |
| `src/pages/parent/ParentPages.tsx` | ParentOverviewPage, ParentAttendancePage, ParentResultsPage, ParentLessonsPage, ParentBehaviorPage, ParentNoticesPage, ParentLessonMonitoringPage, ParentFinancePage |  |
| `src/pages/practice/PracticePages.tsx` | PracticeOverviewPage, PracticeNoticesPage, PracticeLateNoticesPage, PracticeAttendancePage, PracticeBehaviorPage | notifications, profiles |
| `src/pages/practice-teacher/PracticeTeacherPages.tsx` | PracticeTeacherDashboardPage, PracticeStudentsPage, SomaliSpeakingStudentsPage, EnglishSpeakingStudentsPage, PracticeSubmissionsPage, PracticeTeacherAttendancePage |  |
| `src/pages/public/AboutPage.tsx` | AboutPage |  |
| `src/pages/public/ContactPage.tsx` | ContactPage |  |
| `src/pages/public/HomePage.tsx` | HomePage |  |
| `src/pages/shared/chat/Avatar.tsx` | Avatar |  |
| `src/pages/shared/chat/CallOverlay.tsx` | useCall, CallProvider | profiles |
| `src/pages/shared/chat/ChatProfilePage.tsx` | ChatProfilePage |  |
| `src/pages/shared/chat/CommentSection.tsx` | CommentSection |  |
| `src/pages/shared/chat/CommunityFeed.tsx` | CommunityFeed |  |
| `src/pages/shared/chat/CreatePostCard.tsx` | CreatePostCard |  |
| `src/pages/shared/chat/ExplorePage.tsx` | ExplorePage |  |
| `src/pages/shared/chat/feedCache.ts` | FeedCache, updatePostInFeed |  |
| `src/pages/shared/chat/format.ts` | timeAgo, fullTimestamp |  |
| `src/pages/shared/chat/MessagesPanel.tsx` | MessagesPanel | chat-media, follows, profiles |
| `src/pages/shared/chat/PostCard.tsx` | PostCard |  |
| `src/pages/shared/chat/ReelsFeed.tsx` | ReelsFeed |  |
| `src/pages/shared/chat/UserProfileView.tsx` | UserProfileView | profiles |
| `src/pages/shared/ChatPage.tsx` | ChatPage |  |
| `src/pages/shared/LessonMonitoringReview.tsx` | LessonMonitoringReviewPage |  |
| `src/pages/shared/NotificationsPage.tsx` | NotificationsPage |  |
| `src/pages/shared/ProfilePage.tsx` | ProfilePage, TeacherProfilePage, StudentProfilePage |  |
| `src/pages/shared/SettingsPage.tsx` | SettingsPage |  |
| `src/pages/student/AiToolsPage.tsx` | StudentAiToolsPage |  |
| `src/pages/student/AttendancePage.tsx` | StudentAttendancePage |  |
| `src/pages/student/ExamsPage.tsx` | StudentExamsPage |  |
| `src/pages/student/LessonsPage.tsx` | StudentLessonsPage |  |
| `src/pages/student/LessonViewerPage.tsx` | StudentLessonViewerPage |  |
| `src/pages/student/NoticesPage.tsx` | StudentNoticesPage |  |
| `src/pages/student/OverviewPage.tsx` | StudentOverviewPage |  |
| `src/pages/student/QuizzesPage.tsx` | StudentQuizzesPage |  |
| `src/pages/student/ResultsPage.tsx` | StudentResultsPage |  |
| `src/pages/supervisor/OutsideActivityReviewPage.tsx` | SupervisorOutsideActivityReviewPage |  |
| `src/pages/supervisor/SupervisorPages.tsx` | SupervisorDashboardPage, SupervisorReportsPage, SupervisorSomaliSpeakingPage, SupervisorEnglishSpeakingPage, SupervisorActivityPage, SupervisorTeacherAttendancePage, SupervisorReportsOverviewPage |  |
| `src/pages/teacher/AttendancePage.tsx` | TeacherAttendancePage |  |
| `src/pages/teacher/ClassesPage.tsx` | TeacherClassesPage |  |
| `src/pages/teacher/LeavePage.tsx` | TeacherLeavePage |  |
| `src/pages/teacher/LessonMonitoringPage.tsx` | TeacherLessonMonitoringPage |  |
| `src/pages/teacher/LessonsPage.tsx` | TeacherLessonsPage |  |
| `src/pages/teacher/OverviewPage.tsx` | TeacherOverviewPage | lessons |
| `src/pages/teacher/QuizzesPage.tsx` | TeacherQuizzesPage |  |
| `src/pages/teacher/ResultsPage.tsx` | TeacherResultsPage |  |
| `src/providers/AppProviders.tsx` | AppProviders |  |
| `src/providers/AuthProvider.tsx` | AuthProvider, useAuth | profiles, students, teachers |
| `src/providers/ThemeProvider.tsx` | ThemeProvider, useTheme |  |
| `src/routes/AppRouter.tsx` | AppRouter |  |
| `src/routes/index.tsx` | AppRoutes |  |
| `src/routes/ProtectedRoute.tsx` | ProtectedRoute, GuestRoute |  |
| `src/schemas/index.ts` | loginSchema, createStudentSchema, createTeacherSchema, lessonSchema, attendanceStatusSchema, quizSchema, financeRecordSchema, changePasswordSchema, leaveRequestSchema, createCommitteeMemberSchema, outsideActivitySchema, outsideActivityTypeSchema, OUTSIDE_ACTIVITY_TYPES, exportSettingsSchema, automaticBackupSchema, ExportSettingsInput, AutomaticBackupInput, LoginInput, CreateStudentInput, CreateTeacherInput, CreateCommitteeMemberInput, OutsideActivityInput, LessonInput |  |
| `src/services/ai.ts` | AiTool, AiToolType, AiInvokeOptions, TranslateResult, AiInvokeResponse, AiResponse, invokeAiAssistant, translate, runAiTool, listAiConversations, getAiMessages | ai_conversations, ai_messages |
| `src/services/attendance-core.ts` | AttendanceEntry, recordBulkAttendance, getAttendanceHistory, MonthlyAttendanceSummary, getMonthlyAttendanceSummary | attendance, students |
| `src/services/attendance-extra.ts` | listPracticeAttendance, upsertPracticeAttendance | practice_attendance |
| `src/services/attendance.ts` | listAttendance, listTeacherAttendance, upsertTeacherAttendance, upsertAttendance, monthlySummary | teacher_attendance |
| `src/services/audit.ts` | AuditLog, listAuditLogs | audit_logs |
| `src/services/backup.ts` | listBackups, createBackup, downloadBackup, restoreBackup, deleteBackup, listBackupLogs, runRetention, formatBytes, saveAutomaticBackupSettings, loadAutomaticBackupSettings | app_settings, backup_logs, backups |
| `src/services/behavior.ts` | BehaviorCategory, StudentBehavior, listBehavior, addBehavior | student_behavior |
| `src/services/chat.ts` | ConversationSummary, listConversations, getOrCreateDirectConversation, listMessages, sendMessage, followUser, unfollowUser, listFollowing, searchPeers, subscribeToMessages, markConversationRead, softDeleteMessage, listMyConversations, listChatPeers | chat_conversations, chat_messages, chat_participants, follows, profiles, students |
| `src/services/chatFeed.ts` | FeedPage, ReactionResult, listFeedPosts, listReelPosts, createChatPost, updateChatPost, deleteChatPost, listPostComments, createChatComment, updateChatComment, deleteChatComment, toggleReaction, uploadPostImage, uploadPostVideo, ChatNotificationInput, notifyChatActivity, chatLinkForRole, FeedRealtimeHandlers, subscribeToChatFeed, ProfileStats, getProfileStats, listMyPosts | chat-media, chat_post_comments, chat_post_reactions, chat_posts, notifications |
| `src/services/classes.ts` | listClasses, getClass, createClass, updateClass, assignTeacherToClass, unassignTeacherFromClass, listClassTeachers, getClassStudents | classes, students, teacher_classes |
| `src/services/dashboard.ts` | ManagerDashboardStats, TeacherDashboardStats, StudentDashboardStats, getManagerDashboard, getTeacherDashboard, getStudentDashboard, getManagerStats, getTeacherStats, getStudentStats | attendance, audit_logs, classes, finance_records, lessons, notices, notifications, profiles, quizzes, result_submissions, results, students, teacher_classes, teacher_leave, teachers |
| `src/services/dataExport.ts` | EXPORT_MODULES, ExportFormat, ExportFilters, exportData |  |
| `src/services/dataImport.ts` | ImportModule, ImportFormat, ImportRowError, ImportPreview, parseImportFile, buildImportPreview, ImportResult, importData |  |
| `src/services/errors.ts` | serviceError, assertData |  |
| `src/services/finance.ts` | listFinanceRecords, getFinanceRecord, createFinanceRecord, updateFinanceRecord, deleteFinanceRecord, getFinanceSummary, financeSummary, upsertFinanceRecord | finance_records |
| `src/services/index.ts` | UI/configuration |  |
| `src/services/lesson-monitoring.ts` | LessonMonitoringRecord, LessonMonitoringEntry, recordBulkLessonMonitoring, listLessonMonitoring, listChildLessonMonitoring | lesson_monitoring |
| `src/services/lessons.ts` | listLessons, getLesson, createLesson, updateLesson, deleteLesson, uploadLessonFile, getLessonFileSignedUrl, deleteLessonFile, uploadLessonFiles, removeLessonFile | lesson_files, lessons |
| `src/services/notifications.ts` | listNotifications, markNotificationRead, markAllNotificationsRead, getUnreadCount, subscribeToNotifications, markAllRead | notifications |
| `src/services/outsideActivities.ts` | CommitteeMemberRecord, CreateCommitteeMemberPayload, nextCommitteeMemberId, listCommitteeMembers, createCommitteeMember, updateCommitteeMember, resetCommitteeMemberPassword, setCommitteeMemberStatus, getMyCommitteeIds, getMyAssignedClasses, listOutsideActivities, getOutsideActivity, createOutsideActivity, updateOutsideActivity, deleteOutsideActivity, listActivityAttendance, ActivityAttendanceEntry, upsertActivityAttendance, ActivityAttendanceSummary, summarizeActivityAttendance | committee_classes, committee_members, outside_activities, outside_activity_attendance, outside_activity_committees, profiles |
| `src/services/parents.ts` | ParentWithChildren, ParentRecord, listParents, createParent, setParentChildren, nextParentId, setParentStatus, listMyChildren, listChildAttendance, listChildResults, listChildLessons, listChildBehavior, listChildFinance, listPublishedNotices, assertParent | attendance, finance_records, lessons, notices, profiles, results, student_behavior, student_parents |
| `src/services/practice.ts` | listPracticeStudents, getPracticeStudent, createPracticeStudent, updatePracticeStudent, deletePracticeStudent, listActivityLogs | activity_logs, practice_students |
| `src/services/quizzes.ts` | QuestionInput, listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz, addQuestions, startAttempt, submitAttempt, listAttempts, addQuestion, getMyAttempt | quiz_answers, quiz_attempts, quiz_options, quiz_questions, quizzes |
| `src/services/results.ts` | ResultRowInput, listSubmissions, getSubmission, submitResults, reviewResults, publishResults, getPublishedResultsForStudent, listResultSubmissions, getStudentPublishedResults, createResultSubmission, submitForReview, reviewSubmission | result_approvals, result_submissions, results |
| `src/services/school.ts` | listNotices, createNotice, updateNotice, deleteNotice, listExamSchedules, createExamSchedule, listCommittees, createCommittee, getMyCommitteeClasses, listLeaveRequests, createLeaveRequest, reviewLeave, setSchoolWideSocial, updateProfile, uploadAvatar, changePassword | avatars, committee_classes, committee_members, exam_schedules, notices, outside_activity_committees, profiles, teacher_leave |
| `src/services/social.ts` | FollowToggleResult, isFollowing, toggleFollow, listFollowers, getProfileWithCounts, subscribeToFollowCounts, searchUsers, uploadVoiceMessage, STUN_CONFIG, startCall, updateCallStatus, listRecentCalls, CallRealtimeHandlers, subscribeToCalls, SignalHandler, CallSignaling, signalingForCall, getAudioStream, createPeerConnection | calls, chat-media, follows, profiles |
| `src/services/students.ts` | CreateStudentPayload, listStudents, getStudent, getStudentByProfileId, nextStudentId, createStudent, updateStudent, disableStudent, resetStudentPassword, listStudentsByClass, setStudentStatus | profiles, students |
| `src/services/subjects.ts` | listSubjects, createSubject, updateSubject, listAcademicYears, createAcademicYear, updateAcademicYear | academic_years, subjects |
| `src/services/teachers.ts` | CreateTeacherPayload, listTeachers, getTeacher, nextTeacherId, createTeacher, updateTeacher, disableTeacher, resetTeacherPassword, getTeacherClasses, setTeacherStatus, getMyTeacherClasses | profiles, teacher_classes, teachers |
| `src/types/index.ts` | AppRole, AccountStatus, AttendanceStatus, OutsideActivityStatus, PaymentStatus, LeaveStatus, ResultStatus, QuestionType, Profile, Student, Teacher, ClassRecord, Subject, AcademicYear, Lesson, LessonFile, AttendanceRecord, OutsideActivity, OutsideActivityAttendance, CommitteeMember, Quiz, QuizQuestion, QuizOption, FinanceRecord, Notification, ChatMessage, ChatPost, CallStatus, Call, ChatPostComment, ChatPostReaction, PracticeStudent, ActivityLog, AuthUserContext, ROLE_HOME, ROLE_LABELS, ParentChild, BackupFormat, BackupType, BackupStatus, DatabaseBackup, BackupLog, ImportJobStatus, ImportJob, ExportableModule, ExportFormat |  |
| `supabase/config.toml` | server/tooling/schema |  |
| `supabase/functions/_shared/cors.ts` | corsHeaders, jsonResponse, loginIdToEmail |  |
| `supabase/functions/_shared/somali_dictionary.ts` | SO_TO_EN, EN_TO_SO, WordMeaning, normalizeToken, detectDirection, dictionaryLookup |  |
| `supabase/functions/_shared/supabase.ts` | loginIdToEmail, getServiceClient, getAnonClient, requireUser, requireManager, AuthError | profiles |
| `supabase/functions/ai-assistant/index.ts` | server/tooling/schema | ai_conversations, ai_messages |
| `supabase/functions/backup-database/index.ts` | server/tooling/schema | backups, database-backups, profiles |
| `supabase/functions/check-teacher-absence/index.ts` | server/tooling/schema |  |
| `supabase/functions/create-user/index.ts` | server/tooling/schema | audit_logs, profiles, students, teacher_classes, teachers |
| `supabase/functions/import-data/index.ts` | server/tooling/schema | profiles |
| `supabase/functions/reset-password/index.ts` | server/tooling/schema | audit_logs, profiles, students, teachers |
| `supabase/functions/restore-database/index.ts` | server/tooling/schema | backups, database-backups, profiles |
| `supabase/functions/scheduled-backup/index.ts` | server/tooling/schema | database-backups |
| `supabase/functions/seed-teachers/index.ts` | server/tooling/schema | profiles, teacher_classes, teachers |
| `supabase/migrations/001_schema.sql` | server/tooling/schema |  |
| `supabase/migrations/002_functions_rls.sql` | server/tooling/schema |  |
| `supabase/migrations/003_seed_storage.sql` | server/tooling/schema |  |
| `supabase/migrations/004_password_reset_and_ops.sql` | server/tooling/schema |  |
| `supabase/migrations/005_fix_lesson_rls_security_invoker.sql` | server/tooling/schema |  |
| `supabase/migrations/006_student_behavior.sql` | server/tooling/schema |  |
| `supabase/migrations/007_upsert_finance_rpc.sql` | server/tooling/schema |  |
| `supabase/migrations/008_finance_notify_trigger.sql` | server/tooling/schema |  |
| `supabase/migrations/009_list_finance_records.sql` | server/tooling/schema |  |
| `supabase/migrations/010_practice_tables.sql` | server/tooling/schema |  |
| `supabase/migrations/011_practice_workflow.sql` | server/tooling/schema |  |
| `supabase/migrations/012_chat_social.sql` | server/tooling/schema |  |
| `supabase/migrations/013_chat_comment_policy_fix.sql` | server/tooling/schema |  |
| `supabase/migrations/014_outside_activity_workflow.sql` | server/tooling/schema |  |
| `supabase/migrations/015_outside_activity_workflow.sql` | server/tooling/schema |  |
| `supabase/migrations/016_parent_dashboard.sql` | server/tooling/schema |  |
| `supabase/migrations/016_social_tiktok.sql` | server/tooling/schema |  |
| `supabase/migrations/017_social_fix.sql` | server/tooling/schema |  |
| `supabase/migrations/018_chat_conv_select_fix.sql` | server/tooling/schema |  |
| `supabase/migrations/019_chat_media_storage_fix.sql` | server/tooling/schema |  |
| `supabase/migrations/020_security_hardening_rls.sql` | server/tooling/schema |  |
| `supabase/migrations/021_lesson_monitoring.sql` | server/tooling/schema |  |
| `supabase/migrations/022_parent_finance_access.sql` | server/tooling/schema |  |
| `supabase/migrations/023_backup_system.sql` | server/tooling/schema |  |
| `supabase/migrations/024_chat_post_body_check.sql` | server/tooling/schema |  |
| `tsconfig.app.json` | server/tooling/schema |  |
| `tsconfig.json` | server/tooling/schema |  |
| `tsconfig.node.json` | server/tooling/schema |  |
| `vercel.json` | server/tooling/schema |  |
| `vite.config.ts` | server/tooling/schema |  |

## Active route inventory

```tsx
<Route element={<PublicLayout />}>
<Route path="/" element={<HomePage />} />
<Route path="/about" element={<AboutPage />} />
<Route path="/contact" element={<ContactPage />} />
<Route element={<GuestRoute />}>
<Route path="/login" element={<LoginPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route element={roleGuard(['school_manager'])}>
<Route path="/manager" element={<ManagerLayout />}>
<Route index element={<ManagerOverviewPage />} />
<Route path="students" element={<ManagerStudentsPage />} />
<Route path="parents" element={<ManagerParentsPage />} />
<Route path="teachers" element={<ManagerTeachersPage />} />
<Route path="classes" element={<ManagerClassesPage />} />
<Route path="subjects" element={<ManagerSubjectsPage />} />
<Route path="academic-years" element={<ManagerAcademicYearsPage />} />
<Route path="attendance" element={<ManagerAttendancePage />} />
<Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
<Route path="finance" element={<ManagerFinancePage />} />
<Route path="results" element={<ManagerResultsPage />} />
<Route path="outside-activities" element={<ManagerOutsideActivitiesPage />} />
<Route path="outside-activity-committee" element={<ManagerOutsideActivityCommitteePage />} />
<Route path="student-profile" element={<ManagerStudentProfilePage />} />
<Route path="leave" element={<ManagerLeavePage />} />
<Route path="password-resets" element={<ManagerPasswordResetsPage />} />
<Route path="notices" element={<ManagerNoticesPage />} />
<Route path="audit" element={<ManagerAuditLogsPage />} />
<Route path="audit-logs" element={<ManagerAuditLogsPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route path="settings" element={<SettingsPage />} />
<Route path="backup" element={<ManagerBackupPage />} />
<Route path="import" element={<ManagerDataImportPage />} />
<Route element={roleGuard(['teacher'])}>
<Route path="/teacher" element={<TeacherLayout />}>
<Route index element={<TeacherOverviewPage />} />
<Route path="classes" element={<TeacherClassesPage />} />
<Route path="lessons" element={<TeacherLessonsPage />} />
<Route path="attendance" element={<TeacherAttendancePage />} />
<Route path="lesson-monitoring" element={<TeacherLessonMonitoringPage />} />
<Route path="quizzes" element={<TeacherQuizzesPage />} />
<Route path="results" element={<TeacherResultsPage />} />
<Route path="leave" element={<TeacherLeavePage />} />
<Route path="chat" element={<ChatPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route path="profile" element={<TeacherProfilePage />} />
<Route element={roleGuard(['student'])}>
<Route path="/student" element={<StudentLayout />}>
<Route index element={<StudentOverviewPage />} />
<Route path="lessons" element={<StudentLessonsPage />} />
<Route path="lessons/:id" element={<StudentLessonViewerPage />} />
<Route path="attendance" element={<StudentAttendancePage />} />
<Route path="results" element={<StudentResultsPage />} />
<Route path="quizzes" element={<StudentQuizzesPage />} />
<Route path="exams" element={<StudentExamsPage />} />
<Route path="notices" element={<StudentNoticesPage />} />
<Route path="ai-tools" element={<StudentAiToolsPage />} />
<Route path="chat" element={<ChatPage />} />
<Route path="profile" element={<StudentProfilePage />} />
<Route path="settings" element={<SettingsPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['parent'])}>
<Route path="/parent" element={<ParentLayout />}>
<Route index element={<ParentOverviewPage />} />
<Route path="attendance" element={<ParentAttendancePage />} />
<Route path="lesson-monitoring" element={<ParentLessonMonitoringPage />} />
<Route path="results" element={<ParentResultsPage />} />
<Route path="lessons" element={<ParentLessonsPage />} />
<Route path="behavior" element={<ParentBehaviorPage />} />
<Route path="fees" element={<ParentFinancePage />} />
<Route path="notices" element={<ParentNoticesPage />} />
<Route path="settings" element={<SettingsPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['teacher_cabaas'])}>
<Route path="/cabaas" element={<CabaasLayout />}>
<Route index element={<CabaasOverviewPage />} />
<Route path="results-review" element={<CabaasResultsReviewPage />} />
<Route path="teacher-attendance" element={<CabaasTeacherAttendancePage />} />
<Route path="student-attendance" element={<CabaasStudentAttendancePage />} />
<Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
<Route path="outside-activity-attendance" element={<SupervisorOutsideActivityReviewPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['practice_teacher'])}>
<Route path="/practice-teacher" element={<PracticeTeacherLayout />}>
<Route index element={<PracticeTeacherDashboardPage />} />
<Route path="students" element={<PracticeStudentsPage />} />
<Route path="somali-speaking" element={<SomaliSpeakingStudentsPage />} />
<Route path="english-speaking" element={<EnglishSpeakingStudentsPage />} />
<Route path="submissions" element={<PracticeSubmissionsPage />} />
<Route path="attendance" element={<PracticeTeacherAttendancePage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route path="profile" element={<TeacherProfilePage />} />
<Route element={roleGuard(['supervisor'])}>
<Route path="/supervisor" element={<SupervisorLayout />}>
<Route index element={<SupervisorDashboardPage />} />
<Route path="reports" element={<SupervisorReportsPage />} />
<Route path="somali-speaking" element={<SupervisorSomaliSpeakingPage />} />
<Route path="english-speaking" element={<SupervisorEnglishSpeakingPage />} />
<Route path="activity" element={<SupervisorActivityPage />} />
<Route path="teacher-attendance" element={<SupervisorTeacherAttPage />} />
<Route path="lesson-monitoring" element={<LessonMonitoringReviewPage />} />
<Route path="outside-activity-attendance" element={<SupervisorOutsideActivityReviewPage />} />
<Route path="chat" element={<ChatPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route path="reports-overview" element={<SupervisorReportsOverviewPage />} />
<Route path="profile" element={<TeacherProfilePage />} />
<Route element={roleGuard(['finance_officer'])}>
<Route path="/finance" element={<FinanceLayout />}>
<Route index element={<FinanceOverviewPage />} />
<Route path="payments" element={<FinancePaymentsPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['finance_manager'])}>
<Route path="/finance-manager" element={<FinanceManagerLayout />}>
<Route index element={<FinanceManagerOverviewPage />} />
<Route path="reports" element={<FinanceManagerReportsPage />} />
<Route path="chat" element={<ChatPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['outside_activity_committee'])}>
<Route path="/committee" element={<CommitteeLayout />}>
<Route index element={<CommitteeOverviewPage />} />
<Route path="attendance" element={<CommitteeActivityAttendancePage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route element={roleGuard(['attendance_manager'])}>
<Route path="/attendance" element={<AttendanceManagerLayout />}>
<Route index element={<AttendanceManagerOverviewPage />} />
<Route path="students" element={<AttendanceManagerStudentPage />} />
<Route path="teachers" element={<AttendanceManagerTeacherPage />} />
<Route path="notifications" element={<NotificationsPage />} />
<Route path="*" element={<Navigate to="/login" replace />} />
```

## Original provider references

- `.env.example`: lines 1, 2, 15
- `.gitignore`: lines 10
- `package-lock.json`: lines 12, 967, 969, 979, 981, 991, 993, 997, 999, 1009, 1011, 1015, 1022, 1024, 1035, 1037, 1041, 1042, 1043, 1044, 1045
- `package.json`: lines 15
- `README.md`: lines 36, 44, 55, 56, 57, 58, 59, 65, 66, 69, 71, 77, 84, 103
- `scripts/backup.mjs`: lines 12
- `scripts/restructure.py`: lines 23, 38
- `server/.env.example`: lines 30, 31, 32, 33
- `server/MIGRATION.md`: lines 8
- `server/package.json`: lines 13
- `server/scripts/export-supabase.mjs`: lines 7, 8, 19, 20, 22, 23, 55, 58, 59, 85, 88, 89, 116, 118, 127, 164
- `server/scripts/import-mongo.mjs`: lines 66, 68, 73, 78, 79
- `server/scripts/smoke-e2e.mjs`: lines 4
- `server/src/engine.ts`: lines 599
- `server/src/relationships.ts`: lines 83
- `server/src/routes.ts`: lines 45
- `src/lib/mongoClient.ts`: lines 2, 3, 5, 16, 152
- `src/lib/supabase.ts`: lines 1, 5, 6, 8, 10, 29, 32, 33, 34
- `src/pages/auth/ForgotPasswordPage.tsx`: lines 7, 55
- `src/pages/auth/LoginPage.tsx`: lines 37, 38, 39, 41
- `src/pages/manager/LeaveAndResetsPage.tsx`: lines 4, 22, 92, 104, 105
- `src/pages/manager/StudentProfilePage.tsx`: lines 4, 35, 48, 61, 75, 98, 109, 115, 127, 135
- `src/pages/practice/PracticePages.tsx`: lines 12, 196, 202
- `src/pages/shared/chat/CallOverlay.tsx`: lines 16, 209
- `src/pages/shared/chat/MessagesPanel.tsx`: lines 26, 52, 427, 436, 442, 448
- `src/pages/shared/chat/UserProfileView.tsx`: lines 25, 26
- `src/pages/teacher/OverviewPage.tsx`: lines 9, 55
- `src/providers/AuthProvider.tsx`: lines 2, 3, 19, 29, 37, 51, 68, 80, 94, 118, 129
- `src/services/ai.ts`: lines 3, 79, 127, 253, 264
- `src/services/attendance-core.ts`: lines 1, 28, 44, 81, 88
- `src/services/attendance-extra.ts`: lines 1, 6, 27
- `src/services/attendance.ts`: lines 1, 45, 75, 81, 82
- `src/services/audit.ts`: lines 1, 32
- `src/services/backup.ts`: lines 1, 9, 26, 35, 42, 73, 80, 91, 108, 130, 143
- `src/services/behavior.ts`: lines 1, 18, 34
- `src/services/chat.ts`: lines 1, 16, 36, 41, 72, 79, 92, 103, 116, 137, 151, 160, 168, 178, 200, 217, 234, 239, 249, 268, 276
- `src/services/chatFeed.ts`: lines 1, 22, 44, 68, 91, 110, 122, 128, 162, 176, 184, 190, 198, 203, 215, 223, 230, 239, 247, 254, 269, 292, 319, 330, 337, 352
- `src/services/classes.ts`: lines 1, 9, 20, 31, 45, 73, 79, 85, 94, 104, 123
- `src/services/dashboard.ts`: lines 1, 43, 44, 45, 46, 50, 51, 55, 56, 87, 93, 103, 112, 117, 122, 127, 153, 165, 176, 182, 195, 213, 218, 244
- `src/services/dataExport.ts`: lines 1, 40
- `src/services/dataImport.ts`: lines 1, 192
- `src/services/finance.ts`: lines 1, 12, 27, 53, 90, 101, 107, 139, 164
- `src/services/lesson-monitoring.ts`: lines 1, 47, 63, 81
- `src/services/lessons.ts`: lines 1, 12, 28, 47, 83, 94, 110, 119, 133, 145, 156, 164, 165
- `src/services/notifications.ts`: lines 1, 9, 24, 29, 39, 53, 70
- `src/services/outsideActivities.ts`: lines 1, 34, 40, 50, 63, 87, 88, 103, 114, 121, 128, 131, 150, 160, 167, 181, 185, 194, 214, 216, 229, 239, 264, 280, 305, 327, 332, 346, 393
- `src/services/parents.ts`: lines 1, 18, 36, 49, 59, 65, 67, 80, 92, 104, 116, 130, 142, 154
- `src/services/practice.ts`: lines 1, 11, 28, 49, 97, 109, 118
- `src/services/quizzes.ts`: lines 1, 19, 35, 57, 106, 112, 128, 151, 163, 164, 173, 186, 204, 237, 252, 267, 308
- `src/services/results.ts`: lines 1, 18, 33, 57, 84, 100, 113, 131, 142, 152, 163, 205
- `src/services/school.ts`: lines 1, 10, 35, 41, 46, 51, 62, 68, 83, 90, 95, 103, 112, 128, 139, 146, 147, 161, 167, 169, 178, 184, 186, 192, 194, 196
- `src/services/social.ts`: lines 1, 19, 45, 56, 65, 74, 90, 113, 120, 136, 154, 159, 176, 190, 209, 232
- `src/services/students.ts`: lines 1, 24, 53, 63, 74, 80, 118, 123, 130, 136, 151, 175, 177
- `src/services/subjects.ts`: lines 1, 6, 16, 32, 37, 52, 54, 63, 65
- `src/services/teachers.ts`: lines 1, 22, 34, 65, 73, 85, 91, 125, 130, 137, 144, 149, 154, 169, 194, 199, 201
- `supabase/functions/_shared/supabase.ts`: lines 1, 8, 9, 11, 13, 19, 20, 22, 24
- `supabase/functions/ai-assistant/index.ts`: lines 1, 51, 52, 57
- `supabase/functions/backup-database/index.ts`: lines 1, 69, 70, 74, 77
- `supabase/functions/check-teacher-absence/index.ts`: lines 1, 20, 21, 22
- `supabase/functions/create-user/index.ts`: lines 1, 8, 9, 14, 17
- `supabase/functions/import-data/index.ts`: lines 1, 8, 9, 13, 16
- `supabase/functions/reset-password/index.ts`: lines 2
- `supabase/functions/restore-database/index.ts`: lines 1, 16, 17, 21, 24
- `supabase/functions/scheduled-backup/index.ts`: lines 1, 60, 74, 75, 76
- `supabase/functions/seed-teachers/index.ts`: lines 1, 56, 57, 58
- `supabase/migrations/003_seed_storage.sql`: lines 152, 153, 154, 155, 156
- `supabase/migrations/012_chat_social.sql`: lines 236, 237, 238
- `supabase/migrations/016_social_tiktok.sql`: lines 98

## Findings and implementation sequence

1. Preserve React, TypeScript, Tailwind, query/form state, layouts and active router; move them to frontend.
2. Move server business logic to backend; replace Fastify transport with Express controllers and routes.
3. Reconstruct schemas from all migration definitions and frontend contracts; preserve UUID business identifiers.
4. Remove hosted provider SDK, configuration, functions and SQL runtime setup after replacements are present.
5. Repair storage/topic authorization, profile escalation, token expiry/revocation, teacher writes, query filtering, contact persistence and server-side quiz scoring.
6. Run type/build checks, isolated MongoDB API/authorization/persistence tests, then browser route/form/responsive checks.

No production database credentials, exports, uploads, or local environment files were present at discovery. Production data transfer requires a supplied export or connection.

Roles: student, teacher, teacher_cabaas, practice_teacher, supervisor, finance_officer, finance_manager, attendance_manager, outside_activity_committee, school_manager, parent.

Historical SQL and function definitions remain recoverable in Git history; this inventory records their original locations.
