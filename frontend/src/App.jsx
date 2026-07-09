import { useEffect, useMemo, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  email: 'Email',
  web_push: 'Web Push',
}

function App() {
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
    if (window.OneSignal && import.meta.env.VITE_ONESIGNAL_APP_ID) {
      window.OneSignal.push(() => {
        try {
          window.OneSignal.init({
            appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
            allowLocalhostAsSecureOrigin: true,
            notifyButton: { enable: false },
          })
        } catch (err) {
          console.log('OneSignal already initialized or error:', err)
        }
      })
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
    setStatusMessage(`Test send: ${templateId} ${data.success ? 'success' : 'failed'}`)
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
    setStatusMessage(`Trigger fired: ${triggerSlug}`)
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
      <section>
        <h1>Notification System</h1>
        <p>Backend API: <code>{API_URL}</code></p>
        <p>{statusMessage}</p>
      </section>

      <section>
        <h2>Admin Login</h2>
        {!adminToken ? (
          <form onSubmit={handleLogin}>
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
        ) : (
          <div>
            <p>Logged in as admin.</p>
            <button className="secondary" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </section>

      {adminToken && (
        <section>
          <h2>Create New Trigger</h2>
          <form onSubmit={handleCreateTrigger} style={{ display: 'grid', gap: '12px', maxWidth: '520px' }}>
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
      )}

      {adminToken && (
        <section>
          <h2>Admin Panel</h2>
          <table>
            <thead>
              <tr>
                <th>Trigger</th>
                <th>Channel</th>
                <th>Enabled</th>
                <th>Subject / Title</th>
                <th>Body</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {triggers.map((trigger) =>
                trigger.templates.map((template) => (
                  <tr key={template.id}>
                    <td>{trigger.name}</td>
                    <td>{CHANNEL_LABELS[template.channel]}</td>
                    <td>
                      <input
                        type="checkbox"
                        checked={template.enabled}
                        onChange={(e) => handleTemplateChange(trigger.id, template.id, 'enabled', e.target.checked)}
                      />
                    </td>
                    <td>
                      {(template.channel === 'email' || template.channel === 'web_push') && (
                        <input
                          value={template.channel === 'email' ? template.subject : template.title}
                          onChange={(e) => handleTemplateChange(trigger.id, template.id, template.channel === 'email' ? 'subject' : 'title', e.target.value)}
                          placeholder={template.channel === 'email' ? 'Subject' : 'Title'}
                        />
                      )}
                    </td>
                    <td>
                      <textarea
                        value={template.body}
                        rows={3}
                        onChange={(e) => handleTemplateChange(trigger.id, template.id, 'body', e.target.value)}
                      />
                    </td>
                    <td>
                      <button onClick={() => handleTestSend(trigger.slug, template.id)}>Test</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      <section>
        <h2>User Actions</h2>
        <p>Trigger login/logout events from the website.</p>
        <div style={{ display: 'grid', gap: '12px', maxWidth: '420px' }}>
          <button onClick={() => handleTriggerFire('login')}>Fire Login Trigger</button>
          <button className="secondary" onClick={() => handleTriggerFire('logout')}>Fire Logout Trigger</button>
          <button onClick={handleSubscribe}>Subscribe to Web Push</button>
          {subscriberId && <p><small>Push subscriber ID: {subscriberId}</small></p>}
          {isSubscribed && <p><small>Browser push subscription is active.</small></p>}
        </div>
      </section>
    </div>
  )
}

export default App
