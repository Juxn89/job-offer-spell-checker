// Purpose: the checker's built-in word lists (REQ-004, REQ-007, REQ-035): the common job and tech terms
// treated as correct, and the title and common abbreviations accepted when written with their period.
// Every entry is stored lower-cased; the checker compares lower-cased words against them.

/** REQ-004: common job and tech terms treated as correct (A-007: a short built-in list). */
export const TERMS: ReadonlySet<string> = new Set([
  // The ten REQ-004 names.
  'javascript', 'python', 'excel', 'backend', 'frontend', 'freelance', 'home', 'office', 'marketing', 'software', 'scrum',
  // Languages, tools and platforms common in job offers.
  'typescript', 'java', 'kotlin', 'swift', 'golang', 'ruby', 'rails', 'php', 'laravel', 'symfony', 'django', 'flask',
  'react', 'angular', 'vue', 'node', 'nodejs', 'express', 'nestjs', 'nextjs', 'bootstrap', 'tailwind',
  'html', 'css', 'json', 'xml', 'yaml', 'graphql', 'rest', 'restful', 'api', 'apis', 'sdk', 'microservicios',
  'docker', 'kubernetes', 'terraform', 'ansible', 'jenkins', 'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
  'linux', 'unix', 'windows', 'macos', 'android', 'ios', 'azure', 'aws', 'gcp', 'cloud', 'devops', 'devsecops',
  'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'oracle', 'sql', 'nosql', 'firebase', 'elasticsearch',
  'powerpoint', 'outlook', 'word', 'sharepoint', 'teams', 'slack', 'trello', 'notion', 'figma', 'photoshop',
  'illustrator', 'canva', 'salesforce', 'hubspot', 'zendesk', 'tableau', 'looker', 'analytics', 'wordpress', 'shopify',
  'sap', 'erp', 'crm', 'kanban', 'agile', 'lean', 'sprint', 'sprints', 'backlog', 'stakeholders', 'stakeholder',
  // Job-ad vocabulary.
  'online', 'offline', 'remote', 'full', 'stack', 'fullstack', 'part', 'time', 'senior', 'junior', 'trainee',
  'manager', 'managers', 'team', 'leader', 'lead', 'owner', 'product', 'project', 'business', 'partner', 'partners',
  'coaching', 'coach', 'mentoring', 'onboarding', 'feedback', 'networking', 'startup', 'startups', 'know', 'how',
  'branding', 'ecommerce', 'retail', 'call', 'center', 'performance', 'engagement', 'insights', 'growth', 'leads',
  'customer', 'success', 'service', 'support', 'helpdesk', 'tester', 'testing', 'qa', 'ux', 'ui', 'designer',
  'developer', 'developers', 'data', 'big', 'machine', 'learning', 'scientist', 'engineer', 'blockchain', 'fintech',
  'email', 'emails', 'mail', 'newsletter', 'web', 'webs', 'app', 'apps', 'smartphone', 'tablet', 'hardware', 'login',
  'linkedin', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'youtube', 'twitter', 'google', 'microsoft', 'amazon',
  'bonus', 'pack', 'ticket', 'tickets', 'checkin', 'check', 'kpi', 'kpis', 'okr', 'okrs', 'roi', 'seo', 'sem', 'sms',
  'hr', 'rrhh', 'headhunter', 'recruiter', 'recruiting', 'talent', 'skills', 'soft', 'hard', 'workshop', 'webinar',
]);

/**
 * REQ-007 and REQ-035: abbreviations accepted when written with their period. The title abbreviations
 * (TITLES) also stop a period from starting a sentence, so the name after "Lic." or "Dr." is a name.
 */
export const TITLES: ReadonlySet<string> = new Set([
  'lic', 'licda', 'lcdo', 'lcda', 'ldo', 'lda', 'sr', 'sra', 'srta', 'sres', 'dr', 'dra', 'dres', 'ing', 'arq', 'mtro',
  'mtra', 'prof', 'profa', 'abg', 'abog', 'don', 'dña', 'd', 'ud', 'uds', 'cra', 'cr', 'gral', 'tec', 'téc',
]);

/** Other common abbreviations accepted with their period (they may end a sentence). */
export const ABBREVIATIONS: ReadonlySet<string> = new Set([
  'etc', 'aprox', 'máx', 'mín', 'pág', 'págs', 'núm', 'nro', 'dpto', 'depto', 'ej', 'admón', 'atte', 'tel', 'telf',
  'av', 'avda', 'c', 'col', 'cp', 'hrs', 'hs', 'min', 'seg', 'aprox', 'cía', 'sa', 'sl', 'srl', 'ltda', 'vs', 'pza',
  'jr', 'esq', 'ext', 'mín', 'obs', 'p', 'pp', 'ref', 'sig', 'ss', 'vol', 'ed', 'dir', 'adm', 'coord', 'gte', 'asist',
]);
