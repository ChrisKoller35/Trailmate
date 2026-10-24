import { followAll } from '@/lib/onboardingFollow';

describe('followAll', () => {
  it('folgt allen nacheinander, wenn alles klappt', async () => {
    const follow = jest.fn().mockResolvedValue(undefined);
    const result = await followAll(['a', 'b', 'c'], follow);
    expect(result).toEqual({ failed: 0 });
    expect(follow.mock.calls).toEqual([['a'], ['b'], ['c']]);
  });

  it('läuft nach einem Fehler weiter und zählt ihn', async () => {
    const follow = jest.fn((id: string) =>
      id === 'b' ? Promise.reject(new Error('privat')) : Promise.resolve(),
    );
    const result = await followAll(['a', 'b', 'c'], follow);
    expect(result).toEqual({ failed: 1 });
    expect(follow).toHaveBeenCalledTimes(3);
    expect(follow).toHaveBeenLastCalledWith('c');
  });

  it('ruft bei leerer Liste nichts auf', async () => {
    const follow = jest.fn();
    const result = await followAll([], follow);
    expect(result).toEqual({ failed: 0 });
    expect(follow).not.toHaveBeenCalled();
  });
});
