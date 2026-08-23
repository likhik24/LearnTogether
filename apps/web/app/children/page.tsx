'use client';

import { useEffect, useState } from 'react';
import type { ChildProfileDto } from '@learn-and-build/types';
import { getCustomerClient } from '../../lib/customer-session';
import { AppHeader, BottomNav, Icon } from '../ui';

const interestOptions = ['Vehicles', 'STEM', 'Music', 'Art', 'Stories', 'Sports'];

export default function ChildrenPage() {
  const [child, setChild] = useState<ChildProfileDto | null>(null);
  const [name, setName] = useState('Abhiram');
  const [birthDate, setBirthDate] = useState('2021-05-17');
  const [interests, setInterests] = useState(['Vehicles', 'STEM', 'Music']);
  const [message, setMessage] = useState('Saved in this browser');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const client = getCustomerClient();
    if (client) {
      client.listChildren().then((items) => {
        const first = items[0];
        if (!first) { setMessage('Ready to create via API'); return; }
        setChild(first); setName(first.name); setBirthDate(first.birthDate ?? ''); setInterests(first.interests); setMessage('Synced with LearnTogether API');
      }).catch(() => setMessage('API unavailable — changes will stay on this device'));
      return;
    }
    const saved = window.localStorage.getItem('learn-together-child-profile');
    if (saved) {
      try {
        const local = JSON.parse(saved) as { name: string; birthDate: string; interests: string[] };
        setName(local.name); setBirthDate(local.birthDate); setInterests(local.interests);
      } catch {
        window.localStorage.removeItem('learn-together-child-profile');
      }
    }
  }, []);

  function toggleInterest(interest: string) {
    setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  }

  async function save() {
    setSaving(true);
    const client = getCustomerClient();
    try {
      if (client) {
        const result = child
          ? await client.updateChild(child.id, { name, birthDate: birthDate || undefined, interests })
          : await client.createChild({ name, birthDate: birthDate || undefined, interests });
        setChild(result);
        setMessage('Saved to LearnTogether API');
      } else {
        window.localStorage.setItem('learn-together-child-profile', JSON.stringify({ name, birthDate, interests }));
        setMessage('Saved in this browser — sign in to sync');
      }
    } catch {
      window.localStorage.setItem('learn-together-child-profile', JSON.stringify({ name, birthDate, interests }));
      setMessage('API unavailable — saved safely on this device');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-canvas">
      <div className="phone-shell child-page">
        <AppHeader />
        <span className="eyebrow purple">ABHIRAM’S SPACE</span>
        <h1>Growing interests,<br />all in one place.</h1>
        <p>These details help us make calmer, more useful recommendations.</p>
        <section className="child-profile-card">
          <div className="profile-card-heading"><span className="account-avatar">{name.charAt(0).toUpperCase() || 'A'}</span><div><h2>{name || 'Your child'}</h2><small><Icon name="check" size={12} /> {message}</small></div></div>
          <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
          <label>Birthday<input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
          <fieldset><legend>Things they love</legend><div>{interestOptions.map((interest) => <button type="button" aria-pressed={interests.includes(interest)} className={interests.includes(interest) ? 'active' : ''} key={interest} onClick={() => toggleInterest(interest)}>{interest}</button>)}</div></fieldset>
          <button className="primary-wide" onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>
        </section>
        <BottomNav />
      </div>
    </main>
  );
}
