import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { controlClass, labelClass, textareaClass } from './controls';
import { DateField, DateRange } from './DateField';
import { Field } from './Field';
import { SearchToolbar } from './SearchToolbar';

// Every input, select, textarea, date box and filter row in the system is made from
// these. Before them there were four input recipes, five filter-row layouts and a date
// box styled four different ways, at 32, 36, 40, 44 and 48px.

describe('control styling', () => {
  it('is 44px tall with 16px text, so older eyes and thumbs can use it', () => {
    expect(controlClass).toContain('h-11');
    expect(controlClass).toContain('text-sm');
  });

  it('has one border and one focus ring', () => {
    expect(controlClass).toContain('border-slate-300');
    expect(controlClass).toContain('focus:ring-2');
  });

  it('lets a text area grow past the single-line height, in the same border and focus ring', () => {
    expect(textareaClass).toContain('min-h-24');
    expect(textareaClass).not.toContain('h-11');
    expect(textareaClass).toContain('border-slate-300');
    expect(textareaClass).toContain('focus:ring-2');
  });
});

describe('Field', () => {
  it('ties the label to its control and shows a hint', () => {
    const html = renderToStaticMarkup(
      <Field label="Required date" hint="No earlier than today">
        <input className={controlClass} />
      </Field>,
    );

    expect(html).toContain('Required date');
    expect(html).toContain('No earlier than today');
    expect(html).toContain(`class="${labelClass}"`);
    expect(html.startsWith('<label')).toBe(true);
  });

  it('marks a required field with an asterisk a screen reader skips (the control says "required")', () => {
    const html = renderToStaticMarkup(
      <Field label="Item Description" required>
        <input className={controlClass} required />
      </Field>,
    );

    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('>*</span>');
  });

  it('flags an error in words, not only in colour', () => {
    const html = renderToStaticMarkup(
      <Field label="Until" error="Choose a day after today">
        <input className={controlClass} />
      </Field>,
    );

    expect(html).toContain('Choose a day after today');
    expect(html).toContain('role="alert"');
  });
});

describe('DateField', () => {
  it('is a date input in the standard control style', () => {
    const html = renderToStaticMarkup(<DateField value="2026-10-16" onChange={() => undefined} aria-label="From" />);

    expect(html).toContain('type="date"');
    expect(html).toContain('value="2026-10-16"');
    expect(html).toContain('h-11');
    expect(html).toContain('aria-label="From"');
  });

  it('passes the limits and the form field name through', () => {
    const html = renderToStaticMarkup(<DateField name="requiredDate" required min="2026-10-16" max="2026-12-31" />);

    expect(html).toContain('name="requiredDate"');
    expect(html).toContain('min="2026-10-16"');
    expect(html).toContain('max="2026-12-31"');
    expect(html).toContain('required');
  });

  it('is full width unless the caller sets a width', () => {
    expect(renderToStaticMarkup(<DateField />)).toContain('w-full');

    const narrow = renderToStaticMarkup(<DateField className="w-44" />);
    expect(narrow).toContain('w-44');
    expect(narrow).not.toContain('w-full');
  });
});

describe('DateRange', () => {
  it('is a From and a To date box, in the standard control style', () => {
    const html = renderToStaticMarkup(<DateRange from="" to="" onFromChange={() => undefined} onToChange={() => undefined} />);

    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html).toContain('From');
    expect(html).toContain('To');
    expect(html).toContain('h-11');
  });

  it('stops the range being entered backwards: From cannot pass To, To cannot precede From', () => {
    const html = renderToStaticMarkup(
      <DateRange from="2026-10-01" to="2026-10-31" onFromChange={() => undefined} onToChange={() => undefined} />,
    );

    expect(html).toContain('max="2026-10-31"');
    expect(html).toContain('min="2026-10-01"');
  });

  it('puts no limit on an end that is still empty', () => {
    const html = renderToStaticMarkup(<DateRange from="" to="" onFromChange={() => undefined} onToChange={() => undefined} />);

    expect(html).not.toContain('max=');
    expect(html).not.toContain('min=');
  });
});

describe('SearchToolbar', () => {
  const noop = () => undefined;

  it('searches, with a label a screen reader can find', () => {
    const html = renderToStaticMarkup(<SearchToolbar value="" onChange={noop} placeholder="Search assets" />);

    expect(html).toContain('placeholder="Search assets"');
    expect(html).toContain('aria-label="Search assets"');
  });

  it('shows the all-option under its friendly name', () => {
    const html = renderToStaticMarkup(
      <SearchToolbar
        value=""
        onChange={noop}
        filterLabel="All statuses"
        filterValue="All"
        filterOptions={['All', 'Open', 'Closed']}
        onFilterChange={noop}
      />,
    );

    expect(html).toContain('>All statuses</option>');
    expect(html).toContain('>Open</option>');
  });

  it('takes more than one filter, each styled the same', () => {
    const html = renderToStaticMarkup(
      <SearchToolbar
        value=""
        onChange={noop}
        filters={[
          { label: 'All categories', value: '', options: [{ value: '', label: 'All categories' }, { value: 'PPE', label: 'Property, Plant & Equipment' }], onChange: noop },
          { label: 'All statuses', value: '', options: [{ value: '', label: 'All statuses' }, { value: 'issued', label: 'Issued' }], onChange: noop },
        ]}
      />,
    );

    expect(html.match(/<select/g)).toHaveLength(2);
    expect(html).toContain('aria-label="All categories"');
    expect(html).toContain('aria-label="All statuses"');
    expect(html).toContain('>Property, Plant &amp; Equipment</option>');
  });

  it('marks each filter as a drop-down, so it does not look like a plain box', () => {
    const html = renderToStaticMarkup(
      <SearchToolbar value="" onChange={noop} filters={[{ label: 'Status', value: '', options: [{ value: '', label: 'Status' }], onChange: noop }]} />,
    );

    expect(html).toContain('lucide-chevron-down');
  });

  it('draws its own card, or none when it sits inside one', () => {
    expect(renderToStaticMarkup(<SearchToolbar value="" onChange={noop} />)).toContain('shadow-sm');

    const bare = renderToStaticMarkup(<SearchToolbar bare value="" onChange={noop} />);
    expect(bare).not.toContain('shadow-sm');
    expect(bare).not.toContain('border-slate-200');
  });

  it('keeps room for extra controls such as a date range', () => {
    const html = renderToStaticMarkup(
      <SearchToolbar value="" onChange={noop}>
        <DateField aria-label="From" />
      </SearchToolbar>,
    );

    expect(html).toContain('aria-label="From"');
  });
});
