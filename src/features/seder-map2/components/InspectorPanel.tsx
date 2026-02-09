import styles from '../SederMap2.module.css';
import type { InspectorForm, MapDomain, NodeTypeConfig, SelectedTarget } from '../types';

type Props = {
  selected: SelectedTarget;
  form: InspectorForm;
  nodeTypes: NodeTypeConfig[];
  domains: MapDomain[];
  onChange: (patch: Partial<InspectorForm>) => void;
  onSave: () => void;
  onDelete: () => void;
};

export default function InspectorPanel({
  selected,
  form,
  nodeTypes,
  domains,
  onChange,
  onSave,
  onDelete,
}: Props) {
  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorTitle}>Inspector</div>
      {!selected ? <div className={styles.inspectorEmpty}>Выберите объект на карте</div> : null}
      {selected?.kind === 'node' ? (
        <div className={styles.inspectorBody}>
          <label className={styles.fieldLabel}>title_he</label>
          <input className={styles.fieldInput} value={form.title_he} onChange={(e) => onChange({ title_he: e.target.value })} />
          <label className={styles.fieldLabel}>title_ru</label>
          <input className={styles.fieldInput} value={form.title_ru} onChange={(e) => onChange({ title_ru: e.target.value })} />
          <label className={styles.fieldLabel}>node_type</label>
          <select className={styles.fieldInput} value={form.node_type} onChange={(e) => onChange({ node_type: e.target.value })}>
            {nodeTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id}
              </option>
            ))}
          </select>
          <label className={styles.fieldLabel}>domain_id</label>
          <select className={styles.fieldInput} value={form.domain_id} onChange={(e) => onChange({ domain_id: e.target.value })}>
            <option value="">—</option>
            {domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title_ru || d.title_he || d.id}
              </option>
            ))}
          </select>
          <label className={styles.fieldLabel}>spine_parent_id</label>
          <input className={styles.fieldInput} value={form.spine_parent_id} onChange={(e) => onChange({ spine_parent_id: e.target.value })} />
          <label className={styles.fieldLabel}>definition_id</label>
          <input className={styles.fieldInput} value={form.definition_id} onChange={(e) => onChange({ definition_id: e.target.value })} />
        </div>
      ) : null}
      {selected?.kind === 'note' ? (
        <div className={styles.inspectorBody}>
          <label className={styles.fieldLabel}>text</label>
          <textarea className={styles.fieldTextarea} value={form.text} onChange={(e) => onChange({ text: e.target.value })} />
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.fieldLabel}>width</label>
              <input className={styles.fieldInput} value={form.width} onChange={(e) => onChange({ width: e.target.value })} />
            </div>
            <div>
              <label className={styles.fieldLabel}>height</label>
              <input className={styles.fieldInput} value={form.height} onChange={(e) => onChange({ height: e.target.value })} />
            </div>
          </div>
        </div>
      ) : null}
      {selected?.kind === 'domain' ? (
        <div className={styles.inspectorBody}>
          <label className={styles.fieldLabel}>title_he</label>
          <input className={styles.fieldInput} value={form.title_he} onChange={(e) => onChange({ title_he: e.target.value })} />
          <label className={styles.fieldLabel}>title_ru</label>
          <input className={styles.fieldInput} value={form.title_ru} onChange={(e) => onChange({ title_ru: e.target.value })} />
          <label className={styles.fieldLabel}>description</label>
          <textarea className={styles.fieldTextarea} value={form.description} onChange={(e) => onChange({ description: e.target.value })} />
          <div className={styles.fieldRow}>
            <div>
              <label className={styles.fieldLabel}>width</label>
              <input className={styles.fieldInput} value={form.width} onChange={(e) => onChange({ width: e.target.value })} />
            </div>
            <div>
              <label className={styles.fieldLabel}>height</label>
              <input className={styles.fieldInput} value={form.height} onChange={(e) => onChange({ height: e.target.value })} />
            </div>
          </div>
        </div>
      ) : null}
      <div className={styles.inspectorActions}>
        <button type="button" className={styles.toolbarButton} onClick={onSave} disabled={!selected}>
          Save
        </button>
        <button type="button" className={styles.toolbarButton} onClick={onDelete} disabled={!selected}>
          Delete
        </button>
      </div>
    </div>
  );
}
