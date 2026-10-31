/**
 * The app's page map, grouped the way the sidebar and the phone's More page
 * show it. URLs are unchanged from before the redesign so bookmarks and the
 * installed app's start URL keep working; only the labels moved on.
 */
export interface NavLink {
  href: string;
  label: string;
  icon: string;
}

export const NAV_GROUPS: { label: string; links: NavLink[] }[] = [
  {
    label: 'Money',
    links: [
      { href: '/dashboard', label: 'Home', icon: 'home' },
      { href: '/transactions', label: 'Activity', icon: 'transactions' },
      { href: '/credit-card', label: 'Cards', icon: 'creditcard' },
      { href: '/calendar', label: 'Calendar', icon: 'calendar' },
      { href: '/insights', label: 'Insights', icon: 'insights' },
    ],
  },
  {
    label: 'Plan',
    links: [
      { href: '/budget', label: 'Budgets', icon: 'budget' },
      { href: '/subscriptions', label: 'Recurring', icon: 'subscriptions' },
    ],
  },
  {
    label: 'Tidy',
    links: [
      { href: '/review', label: 'Inbox', icon: 'review' },
      { href: '/keywords', label: 'Rules', icon: 'keywords' },
      { href: '/notes', label: 'Notes', icon: 'note' },
    ],
  },
  {
    label: 'System',
    links: [
      { href: '/parser-health', label: 'Sources', icon: 'parsers' },
      { href: '/settings', label: 'Settings', icon: 'settings' },
    ],
  },
];

export const ADMIN_LINKS: NavLink[] = [
  { href: '/admin', label: 'Users', icon: 'users' },
  { href: '/admin/settings', label: 'App settings', icon: 'settings' },
];

/** The phone's bottom bar; everything else lives behind More. */
export const TAB_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Home', icon: 'home' },
  { href: '/transactions', label: 'Activity', icon: 'transactions' },
  { href: '/credit-card', label: 'Cards', icon: 'creditcard' },
  { href: '/more', label: 'More', icon: 'more' },
];

/** '/admin' is a parent of '/admin/settings', so it only matches exactly. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || (href !== '/admin' && pathname.startsWith(href + '/'));
}

/** Pages reached through More count as More on the tab bar. */
export function tabFor(pathname: string): string {
  const direct = TAB_LINKS.find((t) => t.href !== '/more' && isActivePath(pathname, t.href));
  return direct ? direct.href : '/more';
}

/** Fired after something adds or changes transactions outside the page itself
 *  (e.g. the tab bar's + button), so open pages can reload. */
export const DATA_CHANGED_EVENT = 'spendwise:data-changed';
