'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Briefcase, 
  Clock, 
  MapPin, 
  Upload, 
  CheckCircle, 
  AlertCircle,
  ChevronDown,
  Plus,
  Trash2
} from 'lucide-react';
import Script from 'next/script';

// US States for dropdown
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
];

const POSITIONS = [
  'Tire Technician',
  'Service Technician',
  'Sales Associate',
  'Office',
  'Management',
  'Any Available Position'
];

const STORES = [
  { value: 'Pontiac', label: 'Pontiac - 1100 Cesar E Chavez Ave' },
  { value: 'Waterford', label: 'Waterford - 4459 Pontiac Lake Rd' },
  { value: 'Either', label: 'Either Location' }
];

const EMPLOYMENT_TYPES = [
  { value: 'Full Time', label: 'Full Time' },
  { value: 'Part Time', label: 'Part Time' },
  { value: 'Either', label: 'Either' }
];

const EXPERIENCE_YEARS = ['0', '1', '2', '3', '4', '5+'];

const EDUCATION_LEVELS = [
  'High School',
  'Trade School',
  'Some College',
  'Associate Degree',
  'Bachelor\'s Degree',
  'Other'
];

const HEARD_ABOUT_OPTIONS = [
  'Google',
  'Facebook',
  'TikTok',
  'Friend/Family',
  'Walk In',
  'Indeed',
  'Other'
];

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

type DayAvailability = {
  available: boolean;
  startTime: string;
  endTime: string;
};

type Availability = {
  [K in typeof DAYS[number]]?: DayAvailability;
};

type Employer = {
  company: string;
  position: string;
  supervisor: string;
  phone: string;
  startDate: string;
  endDate: string;
  reasonForLeaving: string;
  responsibilities: string;
};

type Reference = {
  name: string;
  relationship: string;
  phone: string;
};

// Turnstile site key - will be undefined if not configured
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export default function CareersPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  
  // Form state
  const [availability, setAvailability] = useState<Availability>(() => {
    const initial: Availability = {};
    DAYS.forEach(day => {
      initial[day] = { available: false, startTime: '08:00', endTime: '17:00' };
    });
    return initial;
  });
  
  const [employers, setEmployers] = useState<Employer[]>([{
    company: '', position: '', supervisor: '', phone: '',
    startDate: '', endDate: '', reasonForLeaving: '', responsibilities: ''
  }]);
  
  const [references, setReferences] = useState<Reference[]>([
    { name: '', relationship: '', phone: '' }
  ]);
  
  const [workedHereBefore, setWorkedHereBefore] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Initialize Turnstile
  useEffect(() => {
    if (typeof window !== 'undefined' && TURNSTILE_SITE_KEY && turnstileRef.current) {
      // @ts-expect-error Turnstile types
      if (window.turnstile) {
        // @ts-expect-error Turnstile types
        window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      }
    }
  }, []);

  const addEmployer = () => {
    if (employers.length < 3) {
      setEmployers([...employers, {
        company: '', position: '', supervisor: '', phone: '',
        startDate: '', endDate: '', reasonForLeaving: '', responsibilities: ''
      }]);
    }
  };

  const removeEmployer = (index: number) => {
    if (employers.length > 1) {
      setEmployers(employers.filter((_, i) => i !== index));
    }
  };

  const updateEmployer = (index: number, field: keyof Employer, value: string) => {
    const updated = [...employers];
    updated[index] = { ...updated[index], [field]: value };
    setEmployers(updated);
  };

  const addReference = () => {
    if (references.length < 3) {
      setReferences([...references, { name: '', relationship: '', phone: '' }]);
    }
  };

  const removeReference = (index: number) => {
    if (references.length > 1) {
      setReferences(references.filter((_, i) => i !== index));
    }
  };

  const updateReference = (index: number, field: keyof Reference, value: string) => {
    const updated = [...references];
    updated[index] = { ...updated[index], [field]: value };
    setReferences(updated);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (!allowedTypes.includes(file.type)) {
        setError('Resume must be a PDF, DOC, or DOCX file.');
        e.target.value = '';
        return;
      }
      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Resume file must be under 10MB.');
        e.target.value = '';
        return;
      }
      setResumeFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Add complex data as JSON
    formData.set('availability', JSON.stringify(availability));
    formData.set('employmentHistory', JSON.stringify(employers.filter(emp => emp.company)));
    formData.set('references', JSON.stringify(references.filter(ref => ref.name)));
    
    // Add resume if selected
    if (resumeFile) {
      formData.set('resume', resumeFile);
    }

    // Add Turnstile token
    if (turnstileToken) {
      formData.set('turnstileToken', turnstileToken);
    }

    try {
      const res = await fetch('/api/employment', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        setError(data.error || 'Failed to submit application. Please try again.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('Failed to submit application. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Success State
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center">
            <div className="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Your application has been received.
            </p>
            <p className="text-gray-600 mb-8">
              If your qualifications match our current openings, someone from Warehouse Tire will contact you.
            </p>
            <div className="bg-gray-50 rounded-xl p-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Questions?</h3>
              <div className="space-y-2 text-gray-600">
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>Pontiac: <a href="tel:248-332-4120" className="text-red-600 hover:underline">(248) 332-4120</a></span>
                </p>
                <p className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-600" />
                  <span>Waterford: <a href="tel:248-683-0070" className="text-red-600 hover:underline">(248) 683-0070</a></span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Turnstile Script */}
      {TURNSTILE_SITE_KEY && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          async
          defer
        />
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-red-700 to-red-900 text-white py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 mb-6">
              <Briefcase className="w-5 h-5" />
              <span className="text-sm font-medium">Now Hiring</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Join the Warehouse Tire Team
            </h1>
            <p className="text-xl text-red-100 max-w-2xl mx-auto">
              Looking for dependable people who enjoy working in a fast-paced automotive environment.
            </p>
            <p className="mt-4 text-red-200">
              Apply online below.
            </p>
          </div>
        </div>

        {/* Application Form */}
        <div className="max-w-4xl mx-auto px-4 py-12 -mt-8">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
            
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-red-700">{error}</p>
              </div>
            )}

            {/* Personal Information */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Personal Information
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="John"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="Smith"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="(248) 555-1234"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="john.smith@email.com"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="streetAddress" className="block text-sm font-medium text-gray-700 mb-2">
                    Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="streetAddress"
                    name="streetAddress"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="123 Main Street"
                  />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="Pontiac"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                      State <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        id="state"
                        name="state"
                        required
                        defaultValue="Michigan"
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                      >
                        {US_STATES.map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700 mb-2">
                      ZIP <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="zip"
                      name="zip"
                      required
                      maxLength={10}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                      placeholder="48340"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Position Details */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Position Details
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="positionApplyingFor" className="block text-sm font-medium text-gray-700 mb-2">
                    Applying For <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="positionApplyingFor"
                      name="positionApplyingFor"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select a position...</option>
                      {POSITIONS.map(pos => (
                        <option key={pos} value={pos}>{pos}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="preferredStore" className="block text-sm font-medium text-gray-700 mb-2">
                    Preferred Store <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="preferredStore"
                      name="preferredStore"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select a location...</option>
                      {STORES.map(store => (
                        <option key={store.value} value={store.value}>{store.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="desiredPay" className="block text-sm font-medium text-gray-700 mb-2">
                    Desired Pay
                  </label>
                  <input
                    type="text"
                    id="desiredPay"
                    name="desiredPay"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                    placeholder="$18/hour or Negotiable"
                  />
                </div>
                <div>
                  <label htmlFor="availableStartDate" className="block text-sm font-medium text-gray-700 mb-2">
                    Available Start Date
                  </label>
                  <input
                    type="date"
                    id="availableStartDate"
                    name="availableStartDate"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-shadow"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Employment Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-4">
                    {EMPLOYMENT_TYPES.map(type => (
                      <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="employmentType"
                          value={type.value}
                          required
                          className="w-5 h-5 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-gray-700">{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Availability */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Availability
              </h2>
              
              <p className="text-gray-600 mb-4">Select the days you're available and your preferred hours:</p>
              
              <div className="space-y-4">
                {DAYS.map(day => (
                  <div key={day} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl bg-gray-50">
                    <label className="flex items-center gap-3 min-w-[140px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={availability[day]?.available || false}
                        onChange={(e) => setAvailability(prev => ({
                          ...prev,
                          [day]: { ...prev[day]!, available: e.target.checked }
                        }))}
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <span className="font-medium text-gray-700 capitalize">{day}</span>
                    </label>
                    {availability[day]?.available && (
                      <div className="flex items-center gap-2 sm:ml-auto">
                        <input
                          type="time"
                          value={availability[day]?.startTime || '08:00'}
                          onChange={(e) => setAvailability(prev => ({
                            ...prev,
                            [day]: { ...prev[day]!, startTime: e.target.value }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                        <span className="text-gray-500">to</span>
                        <input
                          type="time"
                          value={availability[day]?.endTime || '17:00'}
                          onChange={(e) => setAvailability(prev => ({
                            ...prev,
                            [day]: { ...prev[day]!, endTime: e.target.value }
                          }))}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Qualification Questions */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                Qualification Questions
              </h2>
              
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="font-medium text-gray-700 mb-3">
                    Are you legally authorized to work in the United States? <span className="text-red-500">*</span>
                  </p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="authorizedToWork" value="true" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="authorizedToWork" value="false" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="font-medium text-gray-700 mb-3">
                    Do you have reliable transportation? <span className="text-red-500">*</span>
                  </p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasReliableTransportation" value="true" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasReliableTransportation" value="false" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="font-medium text-gray-700 mb-3">
                    Do you have a valid driver's license? <span className="text-red-500">*</span>
                  </p>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasValidDriversLicense" value="true" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="hasValidDriversLicense" value="false" required className="w-5 h-5 text-red-600 focus:ring-red-500" />
                      <span>No</span>
                    </label>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-50">
                  <p className="font-medium text-gray-700 mb-3">
                    Have you ever worked at Warehouse Tire before? <span className="text-red-500">*</span>
                  </p>
                  <div className="flex gap-6 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="workedHereBefore" 
                        value="true" 
                        required 
                        onChange={() => setWorkedHereBefore(true)}
                        className="w-5 h-5 text-red-600 focus:ring-red-500" 
                      />
                      <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="workedHereBefore" 
                        value="false" 
                        required 
                        onChange={() => setWorkedHereBefore(false)}
                        className="w-5 h-5 text-red-600 focus:ring-red-500" 
                      />
                      <span>No</span>
                    </label>
                  </div>
                  {workedHereBefore && (
                    <input
                      type="text"
                      name="workedHereBeforeExplanation"
                      placeholder="Please explain when and what position..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  )}
                </div>
              </div>
            </section>

            {/* Experience */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                Experience
              </h2>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="yearsAutomotiveExperience" className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Automotive Experience
                  </label>
                  <div className="relative">
                    <select
                      id="yearsAutomotiveExperience"
                      name="yearsAutomotiveExperience"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                    >
                      {EXPERIENCE_YEARS.map(yr => (
                        <option key={yr} value={yr}>{yr} {yr === '5+' ? 'years' : yr === '1' ? 'year' : 'years'}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="yearsTireExperience" className="block text-sm font-medium text-gray-700 mb-2">
                    Years of Tire Experience
                  </label>
                  <div className="relative">
                    <select
                      id="yearsTireExperience"
                      name="yearsTireExperience"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                    >
                      {EXPERIENCE_YEARS.map(yr => (
                        <option key={yr} value={yr}>{yr} {yr === '5+' ? 'years' : yr === '1' ? 'year' : 'years'}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label htmlFor="customerServiceExperience" className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Service Experience
                  </label>
                  <textarea
                    id="customerServiceExperience"
                    name="customerServiceExperience"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="Describe your customer service experience..."
                  />
                </div>
                <div>
                  <label htmlFor="salesExperience" className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Experience
                  </label>
                  <textarea
                    id="salesExperience"
                    name="salesExperience"
                    rows={3}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="Describe your sales experience..."
                  />
                </div>
              </div>

              {/* Skills Checkboxes */}
              <div className="mt-6">
                <p className="text-sm font-medium text-gray-700 mb-4">Skills & Certifications (check all that apply):</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { name: 'isAseCertified', label: 'ASE Certified' },
                    { name: 'hasForkliftExperience', label: 'Forklift' },
                    { name: 'hasAlignmentExperience', label: 'Alignment' },
                    { name: 'hasTpmsExperience', label: 'TPMS' },
                    { name: 'hasMountingBalancingExperience', label: 'Mount & Balance' },
                    { name: 'hasOilChangeExperience', label: 'Oil Change' },
                    { name: 'hasBrakeExperience', label: 'Brakes' },
                    { name: 'hasSuspensionExperience', label: 'Suspension' },
                  ].map(skill => (
                    <label key={skill.name} className="flex items-center gap-2 p-3 rounded-lg bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors">
                      <input
                        type="checkbox"
                        name={skill.name}
                        value="true"
                        className="w-5 h-5 text-red-600 focus:ring-red-500 rounded"
                      />
                      <span className="text-sm text-gray-700">{skill.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            {/* Employment History */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">6</span>
                Employment History
              </h2>
              <p className="text-gray-600 mb-6">List up to 3 previous employers, starting with the most recent.</p>
              
              <div className="space-y-6">
                {employers.map((employer, index) => (
                  <div key={index} className="p-6 rounded-xl bg-gray-50 relative">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Employer {index + 1}</h3>
                      {employers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEmployer(index)}
                          className="text-red-600 hover:text-red-700 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                    <div className="grid md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        value={employer.company}
                        onChange={(e) => updateEmployer(index, 'company', e.target.value)}
                        placeholder="Company Name"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={employer.position}
                        onChange={(e) => updateEmployer(index, 'position', e.target.value)}
                        placeholder="Position/Title"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={employer.supervisor}
                        onChange={(e) => updateEmployer(index, 'supervisor', e.target.value)}
                        placeholder="Supervisor Name"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="tel"
                        value={employer.phone}
                        onChange={(e) => updateEmployer(index, 'phone', e.target.value)}
                        placeholder="Phone Number"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={employer.startDate}
                        onChange={(e) => updateEmployer(index, 'startDate', e.target.value)}
                        placeholder="Start Date (e.g., Jan 2020)"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={employer.endDate}
                        onChange={(e) => updateEmployer(index, 'endDate', e.target.value)}
                        placeholder="End Date (or Present)"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        value={employer.reasonForLeaving}
                        onChange={(e) => updateEmployer(index, 'reasonForLeaving', e.target.value)}
                        placeholder="Reason for Leaving"
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent md:col-span-2"
                      />
                      <textarea
                        value={employer.responsibilities}
                        onChange={(e) => updateEmployer(index, 'responsibilities', e.target.value)}
                        placeholder="Responsibilities"
                        rows={2}
                        className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none md:col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {employers.length < 3 && (
                <button
                  type="button"
                  onClick={addEmployer}
                  className="mt-4 flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Employer
                </button>
              )}
            </section>

            {/* Education */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">7</span>
                Education
              </h2>
              
              <div>
                <label htmlFor="highestEducation" className="block text-sm font-medium text-gray-700 mb-2">
                  Highest Education Completed
                </label>
                <div className="relative max-w-md">
                  <select
                    id="highestEducation"
                    name="highestEducation"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                  >
                    <option value="">Select...</option>
                    {EDUCATION_LEVELS.map(level => (
                      <option key={level} value={level}>{level}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </section>

            {/* References */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">8</span>
                References
              </h2>
              <p className="text-gray-600 mb-6">Please provide up to 3 professional references (not family members).</p>
              
              <div className="space-y-4">
                {references.map((ref, index) => (
                  <div key={index} className="flex flex-col sm:flex-row gap-4 p-4 rounded-xl bg-gray-50">
                    <input
                      type="text"
                      value={ref.name}
                      onChange={(e) => updateReference(index, 'name', e.target.value)}
                      placeholder="Name"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <input
                      type="text"
                      value={ref.relationship}
                      onChange={(e) => updateReference(index, 'relationship', e.target.value)}
                      placeholder="Relationship"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <input
                      type="tel"
                      value={ref.phone}
                      onChange={(e) => updateReference(index, 'phone', e.target.value)}
                      placeholder="Phone"
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    {references.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReference(index)}
                        className="text-red-600 hover:text-red-700 p-2 self-center"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {references.length < 3 && (
                <button
                  type="button"
                  onClick={addReference}
                  className="mt-4 flex items-center gap-2 text-red-600 hover:text-red-700 font-medium"
                >
                  <Plus className="w-5 h-5" />
                  Add Another Reference
                </button>
              )}
            </section>

            {/* Resume Upload */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">9</span>
                Resume Upload
              </h2>
              
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-red-400 transition-colors">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">Upload your resume (optional)</p>
                <p className="text-sm text-gray-500 mb-4">PDF, DOC, or DOCX • Max 10MB</p>
                <label className="inline-block cursor-pointer">
                  <input
                    type="file"
                    name="resume"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <span className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-6 py-3 rounded-xl transition-colors inline-block">
                    Choose File
                  </span>
                </label>
                {resumeFile && (
                  <p className="mt-4 text-green-600 font-medium flex items-center justify-center gap-2">
                    <CheckCircle className="w-5 h-5" />
                    {resumeFile.name}
                  </p>
                )}
              </div>
            </section>

            {/* How did you hear about us */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">10</span>
                Additional Information
              </h2>
              
              <div className="space-y-6">
                <div>
                  <label htmlFor="heardAboutUs" className="block text-sm font-medium text-gray-700 mb-2">
                    How did you hear about us?
                  </label>
                  <div className="relative max-w-md">
                    <select
                      id="heardAboutUs"
                      name="heardAboutUs"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none bg-white"
                    >
                      <option value="">Select...</option>
                      {HEARD_ABOUT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                
                <div>
                  <label htmlFor="additionalComments" className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Comments
                  </label>
                  <textarea
                    id="additionalComments"
                    name="additionalComments"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    placeholder="Is there anything else you'd like us to know?"
                  />
                </div>
              </div>
            </section>

            {/* Agreement & Signature */}
            <section className="bg-white rounded-2xl shadow-sm p-6 md:p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <span className="bg-red-100 text-red-600 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">11</span>
                Certification & Signature
              </h2>
              
              <div className="space-y-6">
                <div className="p-4 bg-gray-50 rounded-xl">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      name="certificationAgreed"
                      value="true"
                      required
                      className="w-5 h-5 text-red-600 focus:ring-red-500 rounded mt-1"
                    />
                    <span className="text-gray-700">
                      I certify that the information provided in this application is true and complete to the best of my knowledge. I understand that false or misleading information may result in rejection of my application or termination of employment. <span className="text-red-500">*</span>
                    </span>
                  </label>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="electronicSignature" className="block text-sm font-medium text-gray-700 mb-2">
                      Electronic Signature (Type Your Full Name) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      id="electronicSignature"
                      name="electronicSignature"
                      required
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent font-medium"
                      placeholder="John Smith"
                    />
                  </div>
                  <div>
                    <label htmlFor="signatureDate" className="block text-sm font-medium text-gray-700 mb-2">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      id="signatureDate"
                      name="signatureDate"
                      required
                      defaultValue={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Turnstile Widget */}
            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center">
                <div ref={turnstileRef}></div>
              </div>
            )}

            {/* Honeypot (hidden from users) */}
            <input
              type="text"
              name="website"
              className="absolute -left-[9999px]"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            {/* Submit Button */}
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={submitting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-xl text-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application'
                )}
              </button>
            </div>

            <p className="text-center text-gray-500 text-sm">
              Warehouse Tire is an equal opportunity employer.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}