import test from 'node:test';
import assert from 'node:assert/strict';

import {
  validateCategoryForm,
  validateCustomerForm,
  validateMenuForm,
  validateRestaurantSettings,
} from './formValidation.js';

test('category validation rejects blank names and malformed image URLs', () => {
  const errors = validateCategoryForm({ name: '   ', description: 'x'.repeat(501), image: 'not a url' });
  assert.deepEqual(errors, {
    name: 'Category name is required.',
    description: 'Description must be 500 characters or fewer.',
    image: 'Enter a valid image URL.',
  });
});

test('customer validation requires a name and at least one contact method', () => {
  const blankErrors = validateCustomerForm({ fullName: ' ', email: '', phone: '' });
  assert.equal(blankErrors.fullName, 'Customer name is required.');
  assert.equal(blankErrors.contact, 'Add a valid phone number or email address.');

  const emailErrors = validateCustomerForm({ fullName: 'A', email: 'bad', phone: '' });
  assert.equal(emailErrors.email, 'Enter a valid email address.');
});

test('menu validation accepts optional blank image but rejects invalid price and URL', () => {
  const ok = validateMenuForm({
    name: 'Paneer Tikka',
    category: 'cat-1',
    price: '120',
    image: '',
    description: 'This dish is prepared fresh every day.',
  });
  assert.deepEqual(ok, {});

  const bad = validateMenuForm({
    name: 'Paneer Tikka',
    category: 'cat-1',
    price: '0',
    image: 'ftp://bad.example',
    description: 'short',
  });
  assert.equal(bad.price, 'Price must be greater than 0.');
  assert.equal(bad.image, 'Enter a valid image URL.');
  assert.equal(bad.description, 'Description must be between 10 and 1200 characters.');
});

test('restaurant settings validation keeps optional URLs blank but rejects malformed values', () => {
  const valid = validateRestaurantSettings({
    name: 'RestoSphere',
    branchCode: 'RS1',
    address: 'Main Road',
    email: '',
    phone: '',
    logoUrl: '',
    website: '',
    gstRate: '12.5',
  });
  assert.deepEqual(valid, {});

  const invalid = validateRestaurantSettings({
    name: 'RestoSphere',
    branchCode: 'RS1',
    address: 'Main Road',
    email: 'not-an-email',
    phone: 'bad',
    logoUrl: 'javascript:alert(1)',
    website: 'not-url',
    gstRate: '101',
  });
  assert.equal(invalid.email, 'Enter a valid email address.');
  assert.equal(invalid.phone, 'Enter a valid phone number.');
  assert.equal(invalid.logoUrl, 'Enter a valid URL.');
  assert.equal(invalid.website, 'Enter a valid URL.');
  assert.equal(invalid.gstRate, 'GST rate must be between 0 and 100.');
});
