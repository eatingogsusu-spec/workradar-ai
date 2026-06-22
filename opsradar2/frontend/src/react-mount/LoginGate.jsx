// 로그인 게이트 (2단계). 기존 9개 화면의 "1회 렌더(memo, re-render 0)" 셸과 완전히 분리된
// 별도 React 트리로 #root 에 마운트된다. 자체 useState 로 세션을 들고 독립적으로 리렌더한다.
//
// 동작:
//  - 세션 없음 → <Login> 풀스크린 렌더 + body.opsradar-login-required 부여(정적 셸 가림).
//  - 세션 있음 → null 렌더 + body 클래스 제거(정적 셸 노출).
//  - 로그인 성공 → 토큰/세션 저장(앱 전역 reader 키와 일치) → setSession → opsRadarApi.reload().
//  - window.__workraderLogout 등록 → app.js logout() 이 이 훅을 호출해 reload 없이 in-place 전환.
//
// 백엔드 무변경: /auth/login(Login.js 내부) 응답 { access_token, user:{id,username,name,role} } 사용.
import { useEffect, useState } from 'react'
import Login from '../Login.jsx'
import './LoginGate.css'

const SESSION_KEY = 'opsradar_session'

// 로그인 상태 판정: top-level access_token 또는 opsradar_session 의 토큰이 있으면 로그인됨.
function readSession() {
  try {
    const token = localStorage.getItem('access_token')
    const raw = localStorage.getItem(SESSION_KEY)
    const sess = raw ? JSON.parse(raw) : null
    if (token) return sess || { access_token: token }
    if (sess && (sess.access_token || sess.token)) return sess
    return null
  } catch {
    return null
  }
}

// 로그인 성공 시 저장. 앱의 모든 토큰 reader(boot-restore.getToken=access_token/token,
// api-integration=access_token→session, isLead=opsradar_session.user.role)와
// clearOpsRadarSession 이 지우는 키 집합에 맞춰 저장한다.
function persistSession(data) {
  const session = {
    access_token: data.access_token,
    token: data.access_token,
    user: data.user || null,
  }
  try {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    if (data.user) {
      localStorage.setItem('opsradar_user_role', data.user.role)
      localStorage.setItem('opsradar_user_name', data.user.name)
      localStorage.setItem('opsradar_user_id', data.user.id)
    }
  } catch (_) {}
  return session
}

export default function LoginGate() {
  const [session, setSession] = useState(readSession)

  // 정적 셸 표시/숨김은 body.opsradar-login-required 로 제어(LoginGate.css 의 규칙 재사용).
  useEffect(() => {
    document.body.classList.toggle('opsradar-login-required', !session)
    return () => document.body.classList.remove('opsradar-login-required')
  }, [session])

  // 전역 로그아웃 훅 등록 → logout()(app.js)이 reload 없이 이 게이트를 로그인 화면으로 전환.
  useEffect(() => {
    window.__workraderLogout = () => {
      try { window.clearOpsRadarSession?.() } catch (_) {}
      setSession(null)
    }
    return () => {
      if (window.__workraderLogout) {
        try { delete window.__workraderLogout } catch (_) { window.__workraderLogout = undefined }
      }
    }
  }, [])

  function handleLogin(data) {
    const next = persistSession(data)
    setSession(next)
    // 토큰이 생겼으니 정적 워크플로우 데이터(캘린더/Todo/대시보드/역할)를 재적재한다.
    Promise.resolve(window.opsRadarApi?.reload?.()).catch(() => {})
    // 사이드바 사용자 표시도 갱신(기본 '김희진' → 실제 로그인 사용자).
    try { window.updateSidebarUserDisplay?.() } catch (_) {}
  }

  if (session) return null
  return <Login onLogin={handleLogin} />
}
