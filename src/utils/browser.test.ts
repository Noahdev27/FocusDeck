import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadText } from './download';
import { createId } from './id';
import { notificationsSupported, requestNotificationPermission, sendNotification } from './notify';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('downloadText', () => {
  it('crée un lien de téléchargement temporaire puis libère l’URL', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:fake');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    downloadText('# Rapport', 'rapport.md', 'text/markdown');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});

describe('createId', () => {
  it('utilise crypto.randomUUID quand il existe', () => {
    expect(createId()).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('se rabat sur un identifiant aléatoire sinon', () => {
    vi.stubGlobal('crypto', {});
    const a = createId();
    const b = createId();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(8);
  });
});

describe('notifications', () => {
  it('signale l’absence de prise en charge', async () => {
    vi.stubGlobal('Notification', undefined);
    Reflect.deleteProperty(window, 'Notification');
    expect(notificationsSupported()).toBe(false);
    expect(await requestNotificationPermission()).toBe('denied');
    expect(() => sendNotification('a', 'b')).not.toThrow();
  });

  it('demande la permission puis envoie une notification cliquable', async () => {
    const instances: { onclick: (() => void) | null; close: () => void }[] = [];
    const close = vi.fn();
    class FakeNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = vi.fn(async () => {
        FakeNotification.permission = 'granted';
        return 'granted' as const;
      });
      onclick: (() => void) | null = null;
      close = close;
      constructor(title: string) {
        void title;
        instances.push(this);
      }
    }
    vi.stubGlobal('Notification', FakeNotification);
    const focus = vi.spyOn(window, 'focus').mockImplementation(() => undefined);

    expect(await requestNotificationPermission()).toBe('granted');
    expect(await requestNotificationPermission()).toBe('granted');
    expect(FakeNotification.requestPermission).toHaveBeenCalledOnce();

    sendNotification('Cycle terminé', 'Pause !');
    expect(instances).toHaveLength(1);
    instances[0]?.onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });

  it('ignore les erreurs des navigateurs qui exigent un Service Worker', () => {
    const ThrowingNotification = Object.assign(
      vi.fn(() => {
        throw new TypeError('Illegal constructor');
      }),
      { permission: 'granted' },
    );
    vi.stubGlobal('Notification', ThrowingNotification);
    expect(() => sendNotification('a', 'b')).not.toThrow();
  });
});
