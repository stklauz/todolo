import { SaveQueue } from '../saveQueue';

jest.useFakeTimers();

describe('SaveQueue', () => {
  it('debounces saves and flushes immediately', () => {
    const onSave = jest.fn();
    const q = new SaveQueue(onSave);

    q.enqueue('debounced', 200);
    q.enqueue('debounced', 200);
    expect(onSave).not.toHaveBeenCalled();

    jest.advanceTimersByTime(199);
    expect(onSave).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(onSave).toHaveBeenCalledTimes(1);

    q.enqueue('debounced', 100);
    q.flush();
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('immediate bypasses debounce', () => {
    const onSave = jest.fn();
    const q = new SaveQueue(onSave);
    q.enqueue('immediate');
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
