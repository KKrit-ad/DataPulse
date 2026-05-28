/**
 * lib/sample.js — Sample data generators (exported for testing).
 */
import { rnd, pick } from './core.js';

export function genSales() {
  const regions    = ['North', 'South', 'East', 'West', 'Central'];
  const categories = ['Electronics', 'Apparel', 'Food & Beverage', 'Home & Garden', 'Sports', 'Automotive'];
  const products   = {
    Electronics: ['Laptop', 'Monitor', 'Headset', 'Phone', 'Camera'],
    Apparel: ['T-Shirt', 'Jacket', 'Jeans', 'Shoes', 'Hat'],
    'Food & Beverage': ['Coffee', 'Tea', 'Protein Bar', 'Energy Drink', 'Juice'],
    'Home & Garden': ['Sofa', 'Lamp', 'Rug', 'Planter', 'Curtain'],
    Sports: ['Bicycle', 'Yoga Mat', 'Dumbbell', 'Running Shoes', 'Swim Cap'],
    Automotive: ['Tire', 'Battery', 'Oil Filter', 'Brake Pad', 'Wiper Blade'],
  };
  const rows = [];
  const start = new Date('2023-01-01');
  for (let i = 0; i < 1000; i++) {
    const cat  = pick(categories);
    const prod = pick(products[cat]);
    const d    = new Date(start.getTime() + rnd(0, 729) * 86400000);
    const units = rnd(1, 50);
    const price = rnd(10, 500);
    const cost  = Math.round(price * (0.4 + Math.random() * 0.3));
    rows.push({
      Date:       d.toISOString().slice(0, 10),
      Region:     pick(regions),
      Category:   cat,
      Product:    prod,
      'Units Sold': units,
      Revenue:    units * price,
      Cost:       units * cost,
      Profit:     units * (price - cost),
      Manager:    pick(['Alice', 'Bob', 'Carol', 'David', 'Eva']),
    });
  }
  return rows;
}

export function genEmployee() {
  const depts = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations', 'Product', 'Design'];
  const roles = {
    Engineering: ['Engineer', 'Senior Engineer', 'Tech Lead', 'Architect'],
    Marketing:   ['Analyst', 'Specialist', 'Manager', 'Director'],
    Sales:       ['Rep', 'Account Exec', 'Sales Manager', 'VP Sales'],
    HR:          ['Recruiter', 'HR Specialist', 'HR Manager', 'CHRO'],
    Finance:     ['Analyst', 'Accountant', 'Finance Manager', 'CFO'],
    Operations:  ['Coordinator', 'Supervisor', 'Ops Manager', 'COO'],
    Product:     ['PM', 'Senior PM', 'Group PM', 'VP Product'],
    Design:      ['Designer', 'UX Lead', 'Design Manager', 'Head of Design'],
  };
  const locations  = ['Bangkok', 'Chiang Mai', 'Phuket', 'Singapore', 'Kuala Lumpur', 'Remote'];
  const statuses   = ['Active', 'Active', 'Active', 'Active', 'On Leave', 'Resigned'];
  const firstNames = ['Anya', 'Ben', 'Chloe', 'Dan', 'Eva', 'Finn', 'Grace', 'Hugo', 'Iris', 'Jake', 'Kim', 'Leo', 'Mia', 'Nina', 'Omar', 'Pam', 'Quinn', 'Ray', 'Sara', 'Tom'];
  const lastNames  = ['Smith', 'Jones', 'Brown', 'Taylor', 'Wilson', 'Davis', 'Clark', 'Lewis', 'Hall', 'Young'];
  const rows = [];
  for (let i = 0; i < 500; i++) {
    const dept = pick(depts);
    const role = pick(roles[dept]);
    const hireY = 2018 + rnd(0, 5);
    const hireM = String(rnd(1, 12)).padStart(2, '0');
    const hireD = String(rnd(1, 28)).padStart(2, '0');
    rows.push({
      Name:                pick(firstNames) + ' ' + pick(lastNames),
      Department:          dept,
      Role:                role,
      Location:            pick(locations),
      Salary:              rnd(35000, 150000),
      'Performance Score': parseFloat((2 + Math.random() * 3).toFixed(1)),
      'Hire Date':         `${hireY}-${hireM}-${hireD}`,
      Status:              pick(statuses),
    });
  }
  return rows;
}

export function genFinance() {
  const depts = ['Engineering', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const types = ['Payroll', 'Infrastructure', 'Marketing Spend', 'Travel', 'Training', 'Vendor'];
  const rows  = [];
  for (let y = 2023; y <= 2024; y++) {
    for (let m = 1; m <= 12; m++) {
      for (const dept of depts) {
        const budget = rnd(50000, 300000);
        const actual = Math.round(budget * (0.7 + Math.random() * 0.6));
        rows.push({
          Month:          `${y}-${String(m).padStart(2, '0')}`,
          Department:     dept,
          Category:       pick(types),
          Budget:         budget,
          Actual:         actual,
          Variance:       actual - budget,
          'Variance %':   parseFloat(((actual - budget) / budget * 100).toFixed(1)),
          Type:           actual > budget ? 'Over Budget' : 'Under Budget',
        });
      }
    }
  }
  return rows;
}
