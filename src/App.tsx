import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { safeLazy } from './utils/safeLazy';

const ChatLayout = safeLazy(() => import('./components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })));
const StudyLanding = safeLazy(() => import('./pages/StudyLanding'));
const AdminLayout = safeLazy(() => import('./pages/AdminLayout'));
const GeneralSettings = safeLazy(() => import('./pages/admin/GeneralSettings'));
const PersonalityList = safeLazy(() => import('./pages/admin/PersonalityList'));
const PersonalityCreate = safeLazy(() => import('./pages/admin/PersonalityCreate'));
const PersonalityEdit = safeLazy(() => import('./pages/admin/PersonalityEdit'));
const PromptEditor = safeLazy(() => import('./pages/admin/PromptEditor'));
const ProfileProgress = safeLazy(() => import('./pages/ProfileProgress'));
const TimelinePage = safeLazy(() => import('./pages/TimelinePage'));
const ZmanimClock = safeLazy(() => import('./pages/ZmanimClock'));
const SederMapPage = safeLazy(() => import('./pages/SederMap2Page'));
const SederMap2Page = safeLazy(() => import('./pages/SederMap2Page'));
const UserManagementPage = safeLazy(() => import('./pages/admin/UserManagement'));
const ProfilesAdminPage = safeLazy(() => import('./pages/admin/ProfilesAdmin.tsx'));
const TalmudicConceptsPage = safeLazy(() => import('./pages/admin/TalmudicConcepts'));
const YiddishWordcardsAdmin = safeLazy(() => import('./pages/admin/YiddishWordcards'));
const YiddishModePage = safeLazy(() => import('./features/yiddish/pages/YiddishModePage'));
import { useTextSelectionListener } from './hooks/useTextSelectionListener';
import { LexiconPanel } from './components/LexiconPanel';
import { ThemeProvider } from './components/theme-provider';
import { FontSettingsProvider } from './contexts/FontSettingsContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
const LoginPage = safeLazy(() => import('./pages/Login'));
const RegisterPage = safeLazy(() => import('./pages/Register'));
import { RequireAuth } from './components/auth/RequireAuth';
const FocusNavOverlay = safeLazy(() => import('./components/study/nav/FocusNavOverlay'));
import { GamificationProvider } from './contexts/GamificationContext';
import { GamificationToasts } from './components/gamification/GamificationToasts';
import { LevelUpCelebration } from './components/gamification/LevelUpCelebration';
import { config } from './config';

const Dashboard = safeLazy(() => import('./pages/Dashboard'));

function AuthenticatedShell() {
  return (
    <div className="h-screen w-full bg-background">
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
      <LexiconPanel />
      <GamificationToasts />
      <LevelUpCelebration />
    </div>
  );
}

function App() {
  useTextSelectionListener();

  return (
    <ThemeProvider defaultTheme="light" storageKey="astra-ui-theme">
      <GamificationProvider>
        <FontSettingsProvider>
          <NavigationProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/login"
                  element={
                    <Suspense fallback={null}>
                      <LoginPage />
                    </Suspense>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <Suspense fallback={null}>
                      <RegisterPage />
                    </Suspense>
                  }
                />
                <Route element={<RequireAuth />}>
                  <Route element={<AuthenticatedShell />}>
                    <Route
                      path="/"
                      element={
                        <Suspense fallback={null}>
                          <Dashboard />
                        </Suspense>
                      }
                    />
                    <Route path="/workbench" element={<Navigate to="/study" replace />} />
                    <Route path="/chat" element={<Navigate to="/" replace />} />
                    <Route
                      path="/chat/:sessionId"
                      element={
                        <Suspense fallback={null}>
                          <ChatLayout />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/study"
                      element={
                        <Suspense fallback={null}>
                          <ChatLayout />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/study/:sessionId"
                      element={
                        <Suspense fallback={null}>
                          <ChatLayout />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/daily/:sessionId"
                      element={
                        <Suspense fallback={null}>
                          <ChatLayout />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/progress"
                      element={
                        <Suspense fallback={null}>
                          <ProfileProgress />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/timeline"
                      element={
                        <Suspense fallback={null}>
                          <TimelinePage />
                        </Suspense>
                      }
                    />
                    <Route path="/map" element={<Navigate to="/lab/map" replace />} />
                    <Route path="/map2" element={<Navigate to="/lab/map" replace />} />
                    <Route
                      path="/lab/map"
                      element={
                        <Suspense fallback={null}>
                          <SederMap2Page />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/clock"
                      element={
                        <Suspense fallback={null}>
                          <ZmanimClock />
                        </Suspense>
                      }
                    />
                    <Route path="/yiddish" element={<Navigate to="/lab/yiddish" replace />} />
                    {config.features.yiddishMode ? (
                      <Route
                        path="/lab/yiddish"
                        element={
                          <Suspense fallback={null}>
                            <YiddishModePage />
                          </Suspense>
                        }
                      />
                    ) : null}
                    <Route element={<RequireAuth admin />}>
                      <Route
                        path="/admin"
                        element={
                          <Suspense fallback={null}>
                            <AdminLayout />
                          </Suspense>
                        }
                      >
                        <Route index element={<Navigate to="/admin/settings" replace />} />
                        <Route
                          path="settings"
                          element={
                            <Suspense fallback={null}>
                              <GeneralSettings />
                            </Suspense>
                          }
                        />
                        <Route
                          path="personalities"
                          element={
                            <Suspense fallback={null}>
                              <PersonalityList />
                            </Suspense>
                          }
                        />
                        <Route
                          path="personalities/new"
                          element={
                            <Suspense fallback={null}>
                              <PersonalityCreate />
                            </Suspense>
                          }
                        />
                        <Route
                          path="personalities/edit/:id"
                          element={
                            <Suspense fallback={null}>
                              <PersonalityEdit />
                            </Suspense>
                          }
                        />
                        <Route
                          path="prompts"
                          element={
                            <Suspense fallback={null}>
                              <PromptEditor />
                            </Suspense>
                          }
                        />
                        <Route
                          path="users"
                          element={
                            <Suspense fallback={null}>
                              <UserManagementPage />
                            </Suspense>
                          }
                        />
                        <Route
                          path="profiles"
                          element={
                            <Suspense fallback={null}>
                              <ProfilesAdminPage />
                            </Suspense>
                          }
                        />
                        <Route
                          path="concepts"
                          element={
                            <Suspense fallback={null}>
                              <TalmudicConceptsPage />
                            </Suspense>
                          }
                        />
                        <Route
                          path="yiddish-words"
                          element={
                            <Suspense fallback={null}>
                              <YiddishWordcardsAdmin />
                            </Suspense>
                          }
                        />
                      </Route>
                    </Route>
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
            <GlobalNavigationModal />
          </NavigationProvider>
        </FontSettingsProvider>
      </GamificationProvider>
    </ThemeProvider>
  );
}

function GlobalNavigationModal() {
  const { isNavOpen, closeNav, onSelectRef, currentRef } = useNavigation();
  return (
    <>
      {isNavOpen ? (
        <Suspense fallback={null}>
          <FocusNavOverlay
            open={isNavOpen}
            onClose={closeNav}
            onSelectRef={onSelectRef}
            currentRef={currentRef}
          />
        </Suspense>
      ) : null}
    </>
  );
}

export default App;
