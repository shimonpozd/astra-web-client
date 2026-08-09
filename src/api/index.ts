import * as chatModule from './chat';
import * as studyModule from './study';
import * as dailyModule from './daily';
import * as yiddishModule from './yiddish';
import * as zmanimModule from './zmanim';
import * as sederModule from './seder';
import * as profilesModule from './profiles';
import * as xpModule from './xp';
import * as adminModule from './admin';

export * from './client';
export * from './streaming';
export * from './chat';
export * from './study';
export * from './daily';
export * from './yiddish';
export * from './zmanim';
export * from './seder';
export * from './profiles';
export * from './xp';
export * from './admin';

export const api = {
  // chat
  getChatList: chatModule.getChatList,
  getChatHistory: chatModule.getChatHistory,
  deleteChat: chatModule.deleteChat,
  deleteSession: chatModule.deleteSession,
  sendMessage: chatModule.sendMessage,
  sendMessageWithBlocks: chatModule.sendMessageWithBlocks,
  explainTerm: chatModule.explainTerm,

  // study
  sendStudyMessage: studyModule.sendStudyMessage,
  resolveRef: studyModule.resolveRef,
  setFocus: studyModule.setFocus,
  setDiscussionFocus: studyModule.setDiscussionFocus,
  navigateBack: studyModule.navigateBack,
  navigateForward: studyModule.navigateForward,
  getStudyState: studyModule.getStudyState,
  getLexicon: studyModule.getLexicon,
  getTalmudComments: studyModule.getTalmudComments,
  getBookshelfCategories: studyModule.getBookshelfCategories,
  getBookshelfItems: studyModule.getBookshelfItems,

  // profiles
  getProfile: profilesModule.getProfile,
  updateProfile: profilesModule.updateProfile,
  regenerateProfile: profilesModule.regenerateProfile,
  deleteProfile: profilesModule.deleteProfile,
  listProfiles: profilesModule.listProfiles,

  // yiddish
  getYiddishSichos: yiddishModule.getYiddishSichos,
  getYiddishSicha: yiddishModule.getYiddishSicha,
  postYiddishAttestation: yiddishModule.postYiddishAttestation,
  updateYiddishQueue: yiddishModule.updateYiddishQueue,
  startYiddishExam: yiddishModule.startYiddishExam,
  generateYiddishMahjongExam: yiddishModule.generateYiddishMahjongExam,
  getYiddishVocab: yiddishModule.getYiddishVocab,
  getYiddishWordCard: yiddishModule.getYiddishWordCard,
  lookupYiddishWordcards: yiddishModule.lookupYiddishWordcards,
  postYiddishTts: yiddishModule.postYiddishTts,
  askYiddish: yiddishModule.askYiddish,

  // daily
  getDailyCalendar: dailyModule.getDailyCalendar,
  createDailySessionLazy: dailyModule.createDailySessionLazy,
  markDailyComplete: dailyModule.markDailyComplete,
  getDailyProgress: dailyModule.getDailyProgress,
  getDailySegments: dailyModule.getDailySegments,

  // zmanim & geo
  getZmanimMethods: zmanimModule.getZmanimMethods,
  calculateZmanim: zmanimModule.calculateZmanim,
  getElevation: zmanimModule.getElevation,

  // seder
  getSederMap: sederModule.getSederMap,
  getSederNode: sederModule.getSederNode,
  getSederArticle: sederModule.getSederArticle,
  updateSederArticle: sederModule.updateSederArticle,
  getSederArticleSegments: sederModule.getSederArticleSegments,
  createSederArticle: sederModule.createSederArticle,
  createSederSegments: sederModule.createSederSegments,
  updateSederSegment: sederModule.updateSederSegment,
  getSederSegmentVersions: sederModule.getSederSegmentVersions,
  restoreSederSegmentVersion: sederModule.restoreSederSegmentVersion,
  upsertSederSegmentLinks: sederModule.upsertSederSegmentLinks,
  getSederDefinitions: sederModule.getSederDefinitions,
  getSederDefinitionInstances: sederModule.getSederDefinitionInstances,
  getSederLayouts: sederModule.getSederLayouts,
  getSederDomains: sederModule.getSederDomains,
  createSederLayout: sederModule.createSederLayout,
  updateSederLayout: sederModule.updateSederLayout,
  updateSederDomain: sederModule.updateSederDomain,
  createSederDomain: sederModule.createSederDomain,
  deleteSederDomain: sederModule.deleteSederDomain,
  createSederEdge: sederModule.createSederEdge,
  deleteSederEdge: sederModule.deleteSederEdge,
  updateSederNode: sederModule.updateSederNode,
  createSederNode: sederModule.createSederNode,
  deleteSederNode: sederModule.deleteSederNode,
  createSederNote: sederModule.createSederNote,
  updateSederNote: sederModule.updateSederNote,
  deleteSederNote: sederModule.deleteSederNote,

  // xp
  getXpProfile: xpModule.getXpProfile,
  postXpEvent: xpModule.postXpEvent,
  getXpHistory: xpModule.getXpHistory,
  getAchievements: xpModule.getAchievements,

  // admin
  adminListUsers: adminModule.adminListUsers,
  adminCreateUser: adminModule.adminCreateUser,
  adminUpdateUser: adminModule.adminUpdateUser,
  adminCreateUserApiKey: adminModule.adminCreateUserApiKey,
  adminUpdateUserApiKey: adminModule.adminUpdateUserApiKey,
  adminDeleteUserApiKey: adminModule.adminDeleteUserApiKey,
  adminListUserSessions: adminModule.adminListUserSessions,
  adminRevokeSession: adminModule.adminRevokeSession,
  adminListUserLoginEvents: adminModule.adminListUserLoginEvents,
  adminListYiddishWordcards: adminModule.adminListYiddishWordcards,
  adminGetYiddishWordcard: adminModule.adminGetYiddishWordcard,
  adminUpdateYiddishWordcard: adminModule.adminUpdateYiddishWordcard,
  adminCreateYiddishWordcard: adminModule.adminCreateYiddishWordcard,
  adminDeleteYiddishWordcard: adminModule.adminDeleteYiddishWordcard,
  adminBulkUpsertYiddishWordcards: adminModule.adminBulkUpsertYiddishWordcards,
};
