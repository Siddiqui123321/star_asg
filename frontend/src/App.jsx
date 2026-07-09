import { useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

// Fixed column order for the admin matrix table.
const CHANNELS = ['whatsapp', 'email', 'web_push']

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web_push: 'Web Push',
}

function App() {
  // 'site'  -> the public website where users log in / log out (fires triggers)
  // 'admin' -> the admin panel (create/edit/toggle/test templates ONLY here)
  const [view, setView] = useState('site')

  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '')
  const [triggers, setTriggers] = useState([])
  const [loginPayload, setLoginPayload] = useState({ username: 'admin', password: 'password' })
  const [statusMessage, setStatusMessage] = useState('')
  const [subscriberId, setSubscriberId] = useState('')
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [newTrigger, setNewTrigger] = useState({ slug: '', name: '', description: '' })

  const authHeaders = useMemo(() => ({
    Authorization: adminToken ? `Bearer ${adminToken}` : '',
    'Content-Type': 'application/json',
  }), [adminToken])

  useEffect(() => {
    if (adminToken) {
      fetchTriggers()
    }
  }, [adminToken])

  useEffect(() => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID
    if (!appId) {
      return
    }
    const initOneSignal = () => {
      if (!window.OneSignal || window.__onesignalInitialized) {
        return
      }
      window.OneSignal.push(() => {
        if (window.__onesignalInitialized) {
          return
        }
        window.OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
        })
        window.__onesignalInitialized = true
      })
    }
    if (window.OneSignal) {
      initOneSignal()
    } else {
      window.OneSignal = window.OneSignal || []
      initOneSignal()
    }
  }, [])

  const fetchTriggers = async () => {
    try {
      const resp = await fetch(`${API_URL}/admin/triggers/`, { headers: authHeaders })
      if (!resp.ok) throw new Error('Unable to load triggers')
      const data = await resp.json()
      setTriggers(data)
    } catch (error) {
      setStatusMessage(error.message)
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    const resp = await fetch(`${API_URL}/admin/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginPayload),
    })
    const data = await resp.json()
    if (resp.ok && data.token) {
      localStorage.setItem('adminToken', data.token)
      setAdminToken(data.token)
      setStatusMessage('Admin login successful')
      fetchTriggers()
    } else {
      setStatusMessage(data.detail || 'Login failed')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    setAdminToken('')
    setTriggers([])
    setStatusMessage('Logged out')
  }

  const handleCreateTrigger = async (event) => {
    event.preventDefault()
    if (!newTrigger.slug || !newTrigger.name) {
      setStatusMessage('Slug and name are required for a new trigger')
      return
    }
    const resp = await fetch(`${API_URL}/admin/triggers/create/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(newTrigger),
    })
    const data = await resp.json()
    if (resp.ok) {
      setStatusMessage(`Created trigger ${data.name}`)
      setNewTrigger({ slug: '', name: '', description: '' })
      fetchTriggers()
    } else {
      setStatusMessage(data.detail || 'Failed to create trigger')
    }
  }

  const handleTemplateChange = async (triggerId, templateId, fieldName, value) => {
    const resp = await fetch(`${API_URL}/admin/templates/${templateId}/`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ [fieldName]: value }),
    })
    if (!resp.ok) {
      setStatusMessage('Failed to save template')
      return
    }
    const updated = await resp.json()
    setTriggers((prev) => prev.map((trigger) => ({
      ...trigger,
      templates: trigger.templates.map((template) => template.id === updated.id ? updated : template),
    })))
    setStatusMessage('Template saved')
  }

  // Creates a template for a trigger+channel that doesn't have one yet.
  // Assumes a backend endpoint that accepts trigger id + channel and returns the new template.
  // If your backend auto-creates empty templates for every channel when a trigger is created,
  // you can remove this and always rely on handleTemplateChange instead.
  const handleCreateTemplate = async (triggerId, channel) => {
    const resp = await fetch(`${API_URL}/admin/templates/create/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ trigger: triggerId, channel, enabled: false, body: '' }),
    })
    const data = await resp.json()
    if (!resp.ok) {
      setStatusMessage(data.detail || 'Failed to create template')
      return
    }
    setTriggers((prev) => prev.map((trigger) => (
      trigger.id === triggerId
        ? { ...trigger, templates: [...trigger.templates, data] }
        : trigger
    )))
    setStatusMessage(`Template created for ${CHANNEL_LABELS[channel]}`)
  }

  const handleTestSend = async (triggerSlug, templateId) => {
    const payload = {
      trigger_slug: triggerSlug,
      user: { name: 'Test user', email: 'test@example.com' },
    }
    if (subscriberId) {
      payload.external_user_ids = [subscriberId]
    }
    const resp = await fetch(`${API_URL}/admin/templates/${templateId}/test/`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload),
    })
    const data = await resp.json()
    setStatusMessage(`Test send: ${data.channel || templateId} ${data.success ? 'success' : `failed (${data.message})`}`)
  }

  const handleTriggerFire = async (triggerSlug) => {
    const payload = {
      trigger_slug: triggerSlug,
      user: { name: 'Test user', email: 'test@example.com' },
    }
    if (subscriberId) {
      payload.external_user_ids = [subscriberId]
    }
    const resp = await fetch(`${API_URL}/trigger-fire/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await resp.json()
    if (!resp.ok) {
      setStatusMessage(data.detail || `Trigger failed: ${triggerSlug}`)
      return
    }
    const summary = (data.results || [])
      .map((result) => `${result.channel}: ${result.success ? 'sent' : result.message}`)
      .join(' | ')
    setStatusMessage(`Trigger fired: ${triggerSlug}${summary ? ` (${summary})` : ''}`)
  }

  const handleSubscribe = () => {
    if (!window.OneSignal) {
      setStatusMessage('OneSignal not loaded yet')
      return
    }
    window.OneSignal.push(async () => {
      const isPushSupported = await window.OneSignal.isPushNotificationsSupported()
      if (!isPushSupported) {
        setStatusMessage('Browser does not support push notifications')
        return
      }
      const isEnabled = await window.OneSignal.isPushNotificationsEnabled()
      if (!isEnabled) {
        await window.OneSignal.registerForPushNotifications()
      }
      const userId = await window.OneSignal.getUserId()
      if (userId) {
        setSubscriberId(userId)
        setIsSubscribed(true)
        await fetch(`${API_URL}/subscribe/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ external_user_id: userId, name: 'Browser Tester' }),
        })
        setStatusMessage('Subscribed for browser push notifications')
      }
    })
  }

  return (
    <div className="container">
      <nav style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button
          className={view === 'site' ? '' : 'secondary'}
          onClick={() => setView('site')}
        >
          Website
        </button>
        <button
          className={view === 'admin' ? '' : 'secondary'}
          onClick={() => setView('admin')}
        >
          Admin Panel
        </button>
      </nav>

      <section>
        <h1>Notification System</h1>
        <p>Backend API: <code>{API_URL}</code></p>
        {statusMessage && <p>{statusMessage}</p>}
      </section>

      {view === 'site' && (
        <PublicSite
          subscriberId={subscriberId}
          isSubscribed={isSubscribed}
          onTriggerFire={handleTriggerFire}
          onSubscribe={handleSubscribe}
        />
      )}

      {view === 'admin' && (
        <AdminPanel
          adminToken={adminToken}
          triggers={triggers}
          loginPayload={loginPayload}
          setLoginPayload={setLoginPayload}
          newTrigger={newTrigger}
          setNewTrigger={setNewTrigger}
          onLogin={handleLogin}
          onLogout={handleLogout}
          onCreateTrigger={handleCreateTrigger}
          onTemplateChange={handleTemplateChange}
          onCreateTemplate={handleCreateTemplate}
          onTestSend={handleTestSend}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Public website: where users actually log in / log out. This is what FIRES
// the triggers. No template editing lives here.
// ---------------------------------------------------------------------------
function PublicSite({ subscriberId, isSubscribed, onTriggerFire, onSubscribe }) {
  return (
    <section>
      <h2>Welcome</h2>
      <p>Use the buttons below to simulate a user logging in or out. Each action fires a trigger.</p>
      <div style={{ display: 'grid', gap: '12px', maxWidth: '420px' }}>
        <button onClick={() => onTriggerFire('login')}>Log In</button>
        <button className="secondary" onClick={() => onTriggerFire('logout')}>Log Out</button>
        <button onClick={onSubscribe}>Subscribe to Web Push</button>
        {subscriberId && <p><small>Push subscriber ID: {subscriberId}</small></p>}
        {isSubscribed && <p><small>Browser push subscription is active.</small></p>}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Admin panel: login, create triggers, and the matrix table
// (rows = triggers, columns = WhatsApp / Email / Web Push).
// All template create/edit/toggle/test actions live ONLY here.
// ---------------------------------------------------------------------------
function AdminPanel({
  adminToken,
  triggers,
  loginPayload,
  setLoginPayload,
  newTrigger,
  setNewTrigger,
  onLogin,
  onLogout,
  onCreateTrigger,
  onTemplateChange,
  onCreateTemplate,
  onTestSend,
}) {
  if (!adminToken) {
    return (
      <section>
        <h2>Admin Login</h2>
        <form onSubmit={onLogin} style={{ display: 'grid', gap: '12px', maxWidth: '360px' }}>
          <div>
            <label>Username</label>
            <input
              value={loginPayload.username}
              onChange={(e) => setLoginPayload({ ...loginPayload, username: e.target.value })}
            />
          </div>
          <div>
            <label>Password</label>
            <input
              type="password"
              value={loginPayload.password}
              onChange={(e) => setLoginPayload({ ...loginPayload, password: e.target.value })}
            />
          </div>
          <button type="submit">Login</button>
        </form>
      </section>
    )
  }

  return (
    <>
      <section>
        <p>Logged in as admin.</p>
        <button className="secondary" onClick={onLogout}>Logout</button>
      </section>

      <section>
        <h2>Create New Trigger</h2>
        <form onSubmit={onCreateTrigger} style={{ display: 'grid', gap: '12px', maxWidth: '520px' }}>
          <div>
            <label>Trigger Slug</label>
            <input
              value={newTrigger.slug}
              onChange={(e) => setNewTrigger({ ...newTrigger, slug: e.target.value })}
              placeholder="login-success"
            />
          </div>
          <div>
            <label>Trigger Name</label>
            <input
              value={newTrigger.name}
              onChange={(e) => setNewTrigger({ ...newTrigger, name: e.target.value })}
              placeholder="Login"
            />
          </div>
          <div>
            <label>Description</label>
            <textarea
              value={newTrigger.description}
              rows={2}
              onChange={(e) => setNewTrigger({ ...newTrigger, description: e.target.value })}
            />
          </div>
          <button type="submit">Create Trigger</button>
        </form>
      </section>

      <section>
        <h2>Notification Settings</h2>
        <p>Rows = triggers. Columns = channels. Manage everything for a trigger from its row.</p>
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Trigger</th>
                {CHANNELS.map((channel) => (
                  <th key={channel}>{CHANNEL_LABELS[channel]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) => (
                <tr key={trigger.id}>
                  <td>
                    <strong>{trigger.name}</strong>
                    <br />
                    <small>{trigger.slug}</small>
                  </td>
                  {CHANNELS.map((channel) => {
                    const template = trigger.templates.find((t) => t.channel === channel)
                    return (
                      <td key={channel} style={{ minWidth: '220px', verticalAlign: 'top' }}>
                        {!template ? (
                          <button
                            className="secondary"
                            onClick={() => onCreateTemplate(trigger.id, channel)}
                          >
                            + Create Template
                          </button>
                        ) : (
                          <div style={{ display: 'grid', gap: '6px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="checkbox"
                                checked={template.enabled}
                                onChange={(e) => onTemplateChange(trigger.id, template.id, 'enabled', e.target.checked)}
                              />
                              Enabled
                            </label>

                            {(channel === 'email' || channel === 'web_push') && (
                              <input
                                value={channel === 'email' ? (template.subject || '') : (template.title || '')}
                                onChange={(e) => onTemplateChange(
                                  trigger.id,
                                  template.id,
                                  channel === 'email' ? 'subject' : 'title',
                                  e.target.value
                                )}
                                placeholder={channel === 'email' ? 'Subject' : 'Title'}
                              />
                            )}

                            {channel === 'whatsapp' && (
                              <div style={{ height: '38px' }} /> // spacer to match subject/title input height
                            )}

                            <textarea
                              value={template.body || ''}
                              rows={3}
                              onChange={(e) => onTemplateChange(trigger.id, template.id, 'body', e.target.value)}
                              placeholder="Body"
                            />

                            <button onClick={() => onTestSend(trigger.slug, template.id)}>
                              Test
                            </button>
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

export default App