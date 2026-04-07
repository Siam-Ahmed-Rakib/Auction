'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { CATEGORIES, CONDITIONS } from '@/lib/utils';
import { ImagePlus, X, Loader2 } from 'lucide-react';

export default function CreateAuctionPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    condition: '',
    startPrice: '',
    reservePrice: '',
    buyNowPrice: '',
    shippingCost: '',
    duration: '7',
    images: [''],
  });

  const durations = [
    { value: '1', label: '1 day' },
    { value: '3', label: '3 days' },
    { value: '5', label: '5 days' },
    { value: '7', label: '7 days' },
    { value: '10', label: '10 days' },
  ];

  function updateField(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: null }));
  }

  function addImageField() {
    setForm(prev => ({ ...prev, images: [...prev.images, ''] }));
  }

  function removeImage(index) {
    setForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }

  function updateImage(index, value) {
    setForm(prev => ({
      ...prev,
      images: prev.images.map((img, i) => (i === index ? value : img)),
    }));
  }

  function validate() {
    const errs = {};
    if (!form.title.trim()) errs.title = 'Title is required';
    if (form.title.length > 80) errs.title = 'Title must be 80 characters or fewer';
    if (!form.description.trim()) errs.description = 'Description is required';
    if (!form.category) errs.category = 'Select a category';
    if (!form.condition) errs.condition = 'Select condition';
    if (!form.startPrice || parseFloat(form.startPrice) < 0.01) errs.startPrice = 'Starting price must be at least $0.01';
    if (form.reservePrice && parseFloat(form.reservePrice) < parseFloat(form.startPrice)) errs.reservePrice = 'Reserve must be ≥ starting price';
    if (form.buyNowPrice && parseFloat(form.buyNowPrice) <= parseFloat(form.startPrice)) errs.buyNowPrice = 'Buy Now must exceed starting price';
    if (form.shippingCost && parseFloat(form.shippingCost) < 0) errs.shippingCost = 'Invalid shipping cost';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setSubmitting(true);
    try {
      const images = form.images.filter(u => u.trim() !== '');
      const endTime = new Date(Date.now() + parseInt(form.duration) * 24 * 60 * 60 * 1000);
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        condition: form.condition,
        startPrice: parseFloat(form.startPrice),
        reservePrice: form.reservePrice ? parseFloat(form.reservePrice) : undefined,
        buyNowPrice: form.buyNowPrice ? parseFloat(form.buyNowPrice) : undefined,
        shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : 0,
        endTime: endTime.toISOString(),
        images,
      };
      const result = await api.createAuction(payload);
      router.push(`/auctions/${result.id}`);
    } catch (err) {
      setErrors({ submit: err.message || 'Failed to create listing' });
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center">
        <p className="text-lg mb-4">Please sign in to create a listing.</p>
        <a href="/auth/login" className="text-ebay-blue underline">Sign in</a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Create a new listing</h1>
      <p className="text-sm text-ebay-gray mb-8">List your item for auction and reach millions of bidders.</p>

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-6">
          {errors.submit}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-1">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => updateField('title', e.target.value)}
            placeholder="e.g. Meta Quest 3 128GB VR Headset — Like New"
            maxLength={80}
            className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-ebay-blue focus:outline-none ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
          />
          <div className="flex justify-between text-xs mt-1">
            {errors.title ? <span className="text-red-500">{errors.title}</span> : <span />}
            <span className="text-ebay-gray">{form.title.length}/80</span>
          </div>
        </div>

        {/* Category + Condition */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Category <span className="text-red-500">*</span></label>
            <select
              value={form.category}
              onChange={e => updateField('category', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select category</option>
              {CATEGORIES.map(c => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
            {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Condition <span className="text-red-500">*</span></label>
            <select
              value={form.condition}
              onChange={e => updateField('condition', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.condition ? 'border-red-500' : 'border-gray-300'}`}
            >
              <option value="">Select condition</option>
              {CONDITIONS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {errors.condition && <p className="text-xs text-red-500 mt-1">{errors.condition}</p>}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description <span className="text-red-500">*</span></label>
          <textarea
            value={form.description}
            onChange={e => updateField('description', e.target.value)}
            rows={5}
            placeholder="Describe your item in detail — brand, model, size, color, defects, etc."
            className={`w-full border rounded-lg px-3 py-2 text-sm ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium mb-1">Images (URLs)</label>
          <p className="text-xs text-ebay-gray mb-2">Paste image URLs. The first image will be the cover photo.</p>
          <div className="space-y-2">
            {form.images.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateImage(i, e.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {form.images.length > 1 && (
                  <button type="button" onClick={() => removeImage(i)} className="text-ebay-gray hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {form.images.length < 8 && (
            <button type="button" onClick={addImageField} className="mt-2 text-sm text-ebay-blue flex items-center gap-1 hover:underline">
              <ImagePlus className="w-4 h-4" /> Add another image
            </button>
          )}
        </div>

        {/* Pricing */}
        <div className="border rounded-xl p-4 bg-gray-50 space-y-4">
          <h3 className="font-medium text-sm">Pricing</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Starting Price <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ebay-gray text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.startPrice}
                  onChange={e => updateField('startPrice', e.target.value)}
                  placeholder="0.99"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm ${errors.startPrice ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              {errors.startPrice && <p className="text-xs text-red-500 mt-1">{errors.startPrice}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reserve Price <span className="text-xs text-ebay-gray font-normal">(optional)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ebay-gray text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.reservePrice}
                  onChange={e => updateField('reservePrice', e.target.value)}
                  placeholder="Hidden minimum"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm ${errors.reservePrice ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              {errors.reservePrice && <p className="text-xs text-red-500 mt-1">{errors.reservePrice}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Buy it Now <span className="text-xs text-ebay-gray font-normal">(optional)</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ebay-gray text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.buyNowPrice}
                  onChange={e => updateField('buyNowPrice', e.target.value)}
                  placeholder="Instant purchase"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm ${errors.buyNowPrice ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              {errors.buyNowPrice && <p className="text-xs text-red-500 mt-1">{errors.buyNowPrice}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Shipping Cost</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ebay-gray text-sm">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.shippingCost}
                  onChange={e => updateField('shippingCost', e.target.value)}
                  placeholder="0.00 = Free"
                  className={`w-full border rounded-lg pl-7 pr-3 py-2 text-sm ${errors.shippingCost ? 'border-red-500' : 'border-gray-300'}`}
                />
              </div>
              {errors.shippingCost && <p className="text-xs text-red-500 mt-1">{errors.shippingCost}</p>}
            </div>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-sm font-medium mb-1">Auction Duration</label>
          <div className="flex gap-2">
            {durations.map(d => (
              <button
                key={d.value}
                type="button"
                onClick={() => updateField('duration', d.value)}
                className={`flex-1 text-center border rounded-lg py-2 text-sm transition ${
                  form.duration === d.value
                    ? 'bg-ebay-blue text-white border-ebay-blue'
                    : 'border-gray-300 hover:border-ebay-blue'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t flex items-center justify-between">
          <p className="text-xs text-ebay-gray">By listing, you agree to AuctionHub&apos;s seller terms.</p>
          <button
            type="submit"
            disabled={submitting}
            className="bg-ebay-blue text-white rounded-full px-8 py-2.5 text-sm font-medium flex items-center gap-2 hover:bg-ebay-blue-dark disabled:opacity-50"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            List Your Item
          </button>
        </div>
      </form>
    </div>
  );
}
