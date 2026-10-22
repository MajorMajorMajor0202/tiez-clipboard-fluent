import { describe, it, expect, vi } from 'vitest';
import { rememberTabTextDrop, routeTabTextDrop } from './tabTextDrop';
function context() {
  let ids = [42, 43];
  const assignExisting = vi.fn(() => { ids = []; });
  const importText = vi.fn();
  return { stamp: {sig:'',time:0}, draggedIds:() => ids, resolveTarget: (_position: unknown, _fallback: boolean) => 'work', assignExisting, importText };
}
describe('text drops onto workspaces', () => {
  it('assigns original entries for native internal drags, including multi-selection', () => {
    const options = context();
    routeTabTextDrop({text:'source text',position:{x:10,y:20}}, options);
    routeTabTextDrop({text:'source text',position:{x:10,y:20}}, options); // Native alias arrives after assignment clears the drag globals.
    expect(options.assignExisting).toHaveBeenCalledExactlyOnceWith([42,43], 'work');
    expect(options.importText).not.toHaveBeenCalled();
  });
  it('does not import again when DOM drop has already assigned the original entry', () => {
    const options = context();
    rememberTabTextDrop(options.stamp, '  original text\n', 'work');
    routeTabTextDrop({text:'original text'}, {...options, draggedIds:() => []});
    expect(options.assignExisting).not.toHaveBeenCalled();
    expect(options.importText).not.toHaveBeenCalled();
  });
  it('does not import internal text dropped outside a workspace target', () => {
    const options = context();
    routeTabTextDrop('internal text', {...options, resolveTarget: (_position, fallback) => fallback ? 'work' : null});
    expect(options.assignExisting).not.toHaveBeenCalled();
    expect(options.importText).not.toHaveBeenCalled();
  });
  it('still imports genuinely external text and does not merge different long texts', () => {
    const options = {...context(), draggedIds: () => []};
    routeTabTextDrop('x'.repeat(60)+'A',options);
    routeTabTextDrop('x'.repeat(60)+'B',options);
    expect(options.importText).toHaveBeenCalledTimes(2);
    expect(options.assignExisting).not.toHaveBeenCalled();
  });
  it('does not merge distinct original entries that happen to have equal text', () => {
    const options = {...context(), draggedIds: () => []};
    routeTabTextDrop({text:'equal text',itemIds:[81]}, options);
    routeTabTextDrop({text:'equal text',itemIds:[82]}, options);
    expect(options.assignExisting).toHaveBeenNthCalledWith(1,[81],'work');
    expect(options.assignExisting).toHaveBeenNthCalledWith(2,[82],'work');
    expect(options.importText).not.toHaveBeenCalled();
  });
  it('accepts source IDs carried by a native payload without global drag state', () => {
    const options = {...context(), draggedIds: () => []};
    routeTabTextDrop({text:'same text',itemIds:[81]},options);
    expect(options.assignExisting).toHaveBeenCalledExactlyOnceWith([81],'work');
    expect(options.importText).not.toHaveBeenCalled();
  });
});
