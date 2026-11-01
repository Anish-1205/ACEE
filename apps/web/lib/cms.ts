import 'server-only';
import { publicGet } from './server-api';

export type Localized = { en: string; te?: string; hi?: string };
export type Company = { name: string; phones: string[]; email?: string; address: Localized; website: string; hours: Localized; branches?: string[] };
type Cms<T> = { key: string; content: T; confirmed: boolean };

// Admin edits appear on public pages within a minute.
export const getCms = <T,>(key: string) => publicGet<Cms<T>>(`/cms/${key}`, 60);
