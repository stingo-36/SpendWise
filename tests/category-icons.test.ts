import { describe, it, expect } from 'vitest';
import { iconForName, categoryIcon } from '@/lib/categoryIcons';

describe('guessing an icon from a subcategory name', () => {
  // Every subcategory currently in the database.
  const live: [string, string][] = [
    ['Cafes', 'coffee'], ['Delivery', 'scooter'], ['Grocery', 'basket'], ['Hotels', 'chef'],
    ['Axis CC', 'creditcard'], ['HDFC CC', 'creditcard'], ['BNPL', 'receipt'], ['HDFC Loan', 'bank'], ['InCred', 'bank'],
    ['Mutual funds', 'pie'], ['Recurring deposit', 'piggy'], ['Stocks', 'stocks'],
    ['Cabs', 'car'], ['Flight/Bus Tickets', 'plane'], ['Fuel', 'fuel'], ['Public transport', 'train'], ['Tolls & parking', 'parking'],
    ['Clothing', 'shirt'], ['Electronics', 'laptop'], ['Online', 'package'], ['Personal care', 'scissors'],
    ['Maintenance', 'roller'], ['Rent', 'key'], ['Repairs', 'wrench'],
    ['Broadband', 'wifi'], ['DTH', 'tv'], ['Electricity', 'bolt'], ['Mobile', 'mobile'], ['Subscriptions', 'play'],
    ['Cash withdrawal', 'cash'], ['To people', 'user'], ['To self', 'transfers'], ['Credit card bill', 'creditcard'],
    ['Health', 'health'], ['Uncategorized', 'help'], ['Stocks withdrawal', 'cash'],
    ['Entertainment', 'film'], ['Gift', 'gift'],
  ];
  it.each(live)('%s → %s', (name, icon) => expect(iconForName(name)).toBe(icon));

  it('handles new names it has never seen', () => {
    expect(iconForName('Gym')).toBe('dumbbell');
    expect(iconForName('Netflix')).toBe('play');
    expect(iconForName('Car insurance')).toBe('shield');
    expect(iconForName('Life insurance')).toBe('shield');
    expect(iconForName('Zzz')).toBeNull();
  });
});

describe('the icon a row shows', () => {
  it('prefers a picked icon, then the subcategory name, then the category', () => {
    expect(categoryIcon({ categoryName: 'Food', subcategoryName: 'Cafes', subcategoryIcon: 'gift' })).toBe('gift');
    expect(categoryIcon({ categoryName: 'Food', subcategoryName: 'Cafes' })).toBe('coffee');
    expect(categoryIcon({ categoryName: 'Food', subcategoryName: 'Misc', categoryIcon: 'chef' })).toBe('chef');
    expect(categoryIcon({ categoryName: 'Food', subcategoryName: 'Misc' })).toBe('food');
    expect(categoryIcon({ categoryName: null })).toBe('help');
  });
});
