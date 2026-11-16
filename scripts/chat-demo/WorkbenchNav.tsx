import { useEffect, useState, type MouseEvent } from 'react'
import {
  IconBrowseOutline16,
  IconDataOutline16,
  IconLightOutline16,
  IconLinkOutline16,
  IconRightUpOutline14,
  IconSettingsOutline16,
  IconThinkOutline16,
} from '../base/icons.js'
import { useSettings } from '../../services/settings.js'
import { closeMobileSider } from './mobileSiderState.js'
import styles from './WorkbenchNav.module.css'

const links = [
  { page: 'today', label: '今日工作台', english: 'Today', Icon: IconLightOutline16 },
  { page: 'inbox', label: '研究收件箱', english: 'Research inbox', Icon: IconDataOutline16 },
  { page: 'library', label: '我的知识库', english: 'Knowledge library', Icon: IconBrowseOutline16 },
  { page: 'agent', label: '研究追问', english: 'Research questions', Icon: IconThinkOutline16 },
  { page: 'settings', label: '研究偏好', english: 'Research preferences', Icon: IconSettingsOutline16 },
] as const

type WorkbenchPage = typeof links[number]['page']
type Summary = { inbox: number; agent: number; vaultUri: string }

function navigate(event: MouseEvent<HTMLAnchorElement>, page: WorkbenchPage) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  closeMobileSider()
  window.parent.postMessage({ type: 'wu:workspace-navigate', page }, window.location.origin)
}

export function WorkbenchBrand() {
  const english = useSettings(state => state.locale === 'en-US')
  return <a href="/#today" target="_top" className={styles.brand} onClick={event => navigate(event, 'today')}>
    {english ? 'Wu Workbench' : '悟工作台'}
  </a>
}

export function useWorkbenchSummary(enabled: boolean) {
  const [summary, setSummary] = useState<Summary>({ inbox: 0, agent: 0, vaultUri: '' })
  useEffect(() => {
    if (!enabled) return
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return
      const { type, inbox, agent, vaultUri } = event.data ?? {}
      if (type !== 'wu:workspace-summary' || !Number.isInteger(inbox) || !Number.isInteger(agent)) return
      const uri = typeof vaultUri === 'string' && vaultUri.startsWith('obsidian://open?') ? vaultUri : ''
      setSummary(previous => previous.inbox === inbox && previous.agent === agent && previous.vaultUri === uri
        ? previous : { inbox, agent, vaultUri: uri })
    }
    window.addEventListener('message', receive)
    window.parent.postMessage({ type: 'wu:workspace-ready' }, window.location.origin)
    return () => window.removeEventListener('message', receive)
  }, [enabled])
  return summary
}

export function WorkbenchNav({ summary }: { summary: Summary }) {
  const english = useSettings(state => state.locale === 'en-US')
  return <nav className={styles.nav} aria-label={english ? 'Workbench navigation' : '工作台导航'}>
    {links.map(({ page, label, english: englishLabel, Icon }) => {
      const count = page === 'inbox' || page === 'agent' ? summary[page] : 0
      return <a key={page} className={styles.link} href={'/#' + page} target="_top" onClick={event => navigate(event, page)}>
        <span className={styles.icon} aria-hidden="true"><Icon /></span>
        <span>{english ? englishLabel : label}</span>
        {count > 0 ? <span className={styles.badge}>{count}</span> : null}
      </a>
    })}
  </nav>
}

export function WorkbenchHistoryLabel() {
  const english = useSettings(state => state.locale === 'en-US')
  return <h2 className={styles.historyLabel}>{english ? 'Chat history' : '对话记录'}</h2>
}

export function WorkbenchLinks({ vaultUri }: { vaultUri: string }) {
  const english = useSettings(state => state.locale === 'en-US')
  return <div className={styles.footer}>
    {vaultUri ? <a className={styles.footerLink} href={vaultUri}>
      <IconLinkOutline16 />{english ? 'Obsidian' : '打开 Obsidian'}
    </a> : null}
    <a className={styles.footerLink} href="/chat-demo/" target="_blank" rel="noopener">
      <IconRightUpOutline14 />{english ? 'New window' : '独立窗口'}
    </a>
  </div>
}
