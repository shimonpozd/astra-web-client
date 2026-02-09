import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
const ChatLayout = lazy(() => import('./components/chat/ChatLayout').then(m => ({ default: m.ChatLayout })));
const StudyLanding = lazy(() => import('./pages/StudyLanding'));
const AdminLayout = lazy(() => import('./pages/AdminLayout'));
const GeneralSettings = lazy(() => import('./pages/admin/GeneralSettings'));
const PersonalityList = lazy(() => import('./pages/admin/PersonalityList'));
const PersonalityCreate = lazy(() => import('./pages/admin/PersonalityCreate'));
const PersonalityEdit = lazy(() => import('./pages/admin/PersonalityEdit'));
const PromptEditor = lazy(() => import('./pages/admin/PromptEditor'));
const ProfileProgress = lazy(() => import('./pages/ProfileProgress'));
const TimelinePage = lazy(() => import('./pages/TimelinePage'));
const ZmanimClock = lazy(() => import('./pages/ZmanimClock'));
const SederMapPage = lazy(() => import('./pages/SederMapPage'));
const SederMap2Page = lazy(() => import('./pages/SederMap2Page'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagement'));
const ProfilesAdminPage = lazy(() => import('./pages/admin/ProfilesAdmin.tsx'));
const TalmudicConceptsPage = lazy(() => import('./pages/admin/TalmudicConcepts'));
const YiddishWordcardsAdmin = lazy(() => import('./pages/admin/YiddishWordcards'));
const YiddishModePage = lazy(() => import('./features/yiddish/pages/YiddishModePage'));
import { useTextSelectionListener } from './hooks/useTextSelectionListener';
import { LexiconPanel } from './components/LexiconPanel';
import { ThemeProvider } from './components/theme-provider';
import { FontSettingsProvider } from './contexts/FontSettingsContext';
import { NavigationProvider, useNavigation } from './contexts/NavigationContext';
const LoginPage = lazy(() => import('./pages/Login'));
const RegisterPage = lazy(() => import('./pages/Register'));
import { RequireAuth } from './components/auth/RequireAuth';
const FocusNavOverlay = lazy(() => import('./components/study/nav/FocusNavOverlay'));
import { GamificationProvider } from './contexts/GamificationContext';
import { GamificationToasts } from './components/gamification/GamificationToasts';
import { LevelUpCelebration } from './components/gamification/LevelUpCelebration';
import { config } from './config';

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
                          <ChatLayout />
                        </Suspense>
                      }
                    />
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
                          <StudyLanding />
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
                    <Route
                      path="/map"
                      element={
                        <Suspense fallback={null}>
                          <SederMapPage />
                        </Suspense>
                      }
                    />
                    <Route
                      path="/map2"
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
                    {config.features.yiddishMode ? (
                      <Route
                        path="/yiddish"
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
