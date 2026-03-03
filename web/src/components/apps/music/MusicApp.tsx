import { createSignal, createEffect, onCleanup } from 'solid-js';
import { useRouter } from '../../Phone/PhoneFrame';
import { fetchNui } from '../../../utils/fetchNui';

export function MusicApp() {
  const router = useRouter();
  const [url, setUrl] = createSignal('');
  const [volume, setVolume] = createSignal(50);
  const [distance, setDistance] = createSignal(15);
  const [isPlaying, setIsPlaying] = createSignal(false);
  const [isLoading, setIsLoading] = createSignal(false);

  createEffect(() => {
    const onKey = (e: CustomEvent<string>) => {
      if (e.detail === 'Backspace') router.goBack();
    };
    window.addEventListener('phone:keyUp', onKey as EventListener);
    onCleanup(() => window.removeEventListener('phone:keyUp', onKey as EventListener));
  });

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    const newDistance = Math.round(5 + (val / 100) * 45);
    setDistance(newDistance);
    if (isPlaying()) {
      fetchNui('musicSetVolume', { volume: val / 100, distance: newDistance });
    }
  };

  const handlePlay = async () => {
    const link = url().trim();
    if (!link) return;
    setIsLoading(true);
    await fetchNui('musicPlay', { url: link, volume: volume() / 100, distance: distance() });
    setIsLoading(false);
    setIsPlaying(true);
  };

  const handlePause = () => {
    fetchNui('musicPause');
    setIsPlaying(false);
  };

  const handleResume = () => {
    fetchNui('musicResume');
    setIsPlaying(true);
  };

  const handleStop = () => {
    fetchNui('musicStop');
    setIsPlaying(false);
    setUrl('');
  };

  return (
    <div style={{
      height: '100%',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      display: 'flex',
      'flex-direction': 'column',
      padding: '16px',
      'box-sizing': 'border-box',
    }}>
      <div style={{
        display: 'flex',
        'align-items': 'center',
        'margin-bottom': '24px',
        gap: '12px',
      }}>
        <button
          onClick={() => router.goBack()}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            'border-radius': '12px',
            width: '36px',
            height: '36px',
            color: '#fff',
            'font-size': '20px',
            cursor: 'pointer',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
          }}
        >
          ‹
        </button>
        <h1 style={{
          color: '#fff',
          'font-size': '22px',
          'font-weight': '600',
          margin: '0',
        }}>
          Musica
        </h1>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.08)',
        'border-radius': '16px',
        padding: '20px',
        'margin-bottom': '16px',
      }}>
        <div style={{
          display: 'flex',
          'align-items': 'center',
          gap: '10px',
          'margin-bottom': '20px',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'border-radius': '14px',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            'font-size': '24px',
          }}>
            🎵
          </div>
          <div style={{ flex: '1' }}>
            <div style={{ color: 'rgba(255,255,255,0.5)', 'font-size': '12px', 'margin-bottom': '4px' }}>
              {isPlaying() ? 'Reproduciendo' : 'Pega un link de YouTube'}
            </div>
            <div style={{
              color: '#fff',
              'font-size': '14px',
              'white-space': 'nowrap',
              overflow: 'hidden',
              'text-overflow': 'ellipsis',
              'max-width': '200px',
            }}>
              {url() || 'Sin URL'}
            </div>
          </div>
        </div>

        <input
          type="text"
          placeholder="https://youtube.com/watch?v=..."
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          disabled={isPlaying()}
          style={{
            width: '100%',
            padding: '12px 14px',
            'border-radius': '12px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(0,0,0,0.3)',
            color: '#fff',
            'font-size': '14px',
            'box-sizing': 'border-box',
            outline: 'none',
          }}
        />
      </div>

      <div style={{
        display: 'flex',
        'justify-content': 'center',
        gap: '12px',
        'margin-bottom': '24px',
      }}>
        {!isPlaying() ? (
          <button
            onClick={handlePlay}
            disabled={!url().trim() || isLoading()}
            style={{
              width: '64px',
              height: '64px',
              'border-radius': '50%',
              border: 'none',
              background: url().trim()
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                : 'rgba(255,255,255,0.2)',
              color: '#fff',
              'font-size': '28px',
              cursor: url().trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              'align-items': 'center',
              'justify-content': 'center',
              opacity: url().trim() ? 1 : 0.5,
              transition: 'transform 0.15s ease',
            }}
          >
            {isLoading() ? '⏳' : '▶'}
          </button>
        ) : (
          <>
            <button
              onClick={handlePause}
              style={{
                width: '56px',
                height: '56px',
                'border-radius': '50%',
                border: 'none',
                background: 'rgba(255,255,255,0.15)',
                color: '#fff',
                'font-size': '22px',
                cursor: 'pointer',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
              }}
            >
              ⏸
            </button>
            <button
              onClick={handleResume}
              style={{
                width: '56px',
                height: '56px',
                'border-radius': '50%',
                border: 'none',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                'font-size': '22px',
                cursor: 'pointer',
                display: 'flex',
                'align-items': 'center',
                'justify-content': 'center',
              }}
            >
              ▶
            </button>
          </>
        )}
        <button
          onClick={handleStop}
          disabled={!isPlaying()}
          style={{
            width: '56px',
            height: '56px',
            'border-radius': '50%',
            border: 'none',
            background: isPlaying() ? 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' : 'rgba(255,255,255,0.15)',
            color: '#fff',
            'font-size': '22px',
            cursor: isPlaying() ? 'pointer' : 'not-allowed',
            display: 'flex',
            'align-items': 'center',
            'justify-content': 'center',
            opacity: isPlaying() ? 1 : 0.5,
          }}
        >
          ⏹
        </button>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.08)',
        'border-radius': '16px',
        padding: '16px',
      }}>
        <div style={{ 'margin-bottom': '16px' }}>
          <div style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '8px',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', 'font-size': '13px' }}>Volumen</span>
            <span style={{ color: '#fff', 'font-size': '14px', 'font-weight': '600' }}>{volume()}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume()}
            onInput={(e) => handleVolumeChange(Number(e.currentTarget.value))}
            style={{
              width: '100%',
              height: '6px',
              'border-radius': '3px',
              appearance: 'none',
              background: `linear-gradient(to right, #667eea 0%, #764ba2 ${volume()}%, rgba(255,255,255,0.2) ${volume()}%)`,
              cursor: 'pointer',
            }}
          />
        </div>

        <div>
          <div style={{
            display: 'flex',
            'justify-content': 'space-between',
            'align-items': 'center',
            'margin-bottom': '8px',
          }}>
            <span style={{ color: 'rgba(255,255,255,0.7)', 'font-size': '13px' }}>Distancia 3D</span>
            <span style={{ color: '#fff', 'font-size': '14px', 'font-weight': '600' }}>{distance()}m</span>
          </div>
          <div style={{
            height: '6px',
            'border-radius': '3px',
            background: `linear-gradient(to right, #f093fb 0%, #f5576c ${(distance() - 5) / 45 * 100}%, rgba(255,255,255,0.2) ${(distance() - 5) / 45 * 100}%)`,
          }} />
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            'font-size': '11px',
            'margin-top': '6px',
            'text-align': 'center',
          }}>
            Sube el volumen para aumentar el alcance
          </div>
        </div>
      </div>
    </div>
  );
}
