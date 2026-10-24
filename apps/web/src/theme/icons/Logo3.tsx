import type { SvgIconProps } from '@mui/material';
import { SvgIcon } from '@mui/material';

export interface Logo3Props extends SvgIconProps {
  /** Color of the "S" letter (data-name="S"). */
  letterColor?: string;
  /** Color of the ring sweep (data-name="ring"). */
  ringColor?: string;
  /** Color of the star (data-name="star"). */
  starColor?: string;
  /**
   * Constant-pixel outline added on top of each filled shape to keep the thin
   * letter/ring from looking starved at small render sizes. Because it uses a
   * non-scaling stroke, the weight is in *screen pixels* and stays put as the
   * icon scales down. Set to 0 to disable.
   */
  weight?: number;
}

export const Logo3 = ({
  letterColor = '#121f36',
  ringColor = '#121f36',
  starColor = '#f7931e',
  weight = 0,
  ...props
}: Logo3Props) => {
  // Same-color non-scaling stroke fattens the filled shapes at small sizes.
  const stroke = (color: string) =>
    weight > 0
      ? {
          stroke: color,
          strokeWidth: weight,
          strokeLinejoin: 'round' as const,
          vectorEffect: 'non-scaling-stroke' as const,
        }
      : {};

  return (
    <SvgIcon {...props} viewBox="0 0 190.537 159.198" fill="none">
      <g data-name="Layer 1">
        <g data-name="S" fill={letterColor} {...stroke(letterColor)}>
          <path d="M40.382,151.282v4.853c16.393,1.773,31.235,2.438,42.976,2.438,17.721,0,31.678-1.552,42.976-8.641,11.944-7.244,17.457-20.03,18.581-33.304-34.048,16.957-70.334,28.943-104.533,34.653Z" />
          <path d="M76.27,88.57c7.753,2.216,16.171,4.431,23.26,6.646,5.531,1.804,9.483,4.139,11.951,7.484,2.467-1.03,4.865-2.061,7.168-3.087,6.955-3.098,14.427-6.554,21.973-10.379-5.863-11.71-17.36-18.413-34.224-22.373-7.975-2.214-15.286-3.987-21.932-5.98-9.303-3.323-13.955-8.197-13.955-17.28,0-6.423,2.88-13.069,9.968-15.949,6.423-2.438,13.069-2.659,21.266-2.659,9.968,0,23.703,1.329,36.108,2.88V3.284c-14.842-1.773-28.355-2.659-39.21-2.659-16.171,0-29.242,1.329-40.539,8.418-12.626,7.754-18.164,22.153-18.164,37.217,0,24.367,12.405,35.665,36.33,42.31Z" />
        </g>
        <path
          data-name="ring"
          fill={ringColor}
          {...stroke(ringColor)}
          d="M151.125,59.216c8.595-3.408,28.607-10.811,36.644-5.126,2.929,1.994,3.313,6.448,2.175,9.358-1.158,3.557-3.309,6.626-5.448,9.465-13.627,14.643-29.428,27.421-46.78,37.642-25.883,15.209-54.791,25.082-84.495,29.163-11.073,1.553-22.326,2.233-33.55,1.857-6.86-.248-22.1-.753-19.341-11.225,3.459-8.791,21.1-16.981,29.504-20.697-4,2.846-7.913,5.784-11.688,8.827-3.622,2.991-7.353,6.19-10.237,9.798-.928,1.204-1.755,2.378-2.05,3.709-.04.298.005.479.049.508.04.033.042-.028.159.049.105.064.314.206.654.336,4.984,1.636,11.118.7,16.401.422,9.501-.712,19.004-2.132,28.39-3.94,28.084-5.474,55.439-15.031,80.525-28.784,16.303-8.754,33.588-21.306,46.609-32.627,2.274-2.553,4.954-5.302,5.627-8.546-.002-.361.047-.449-.225-.8-5.624-4.251-25.581-.539-32.924.609h0Z"
        />
        <path
          data-name="star"
          fill={starColor}
          {...stroke(starColor)}
          d="M65.212,99.358l-6.57,7.12,2.14,9.447c.154.673-.091,1.374-.626,1.809-.302.246-.67.381-1.045.402-.289.016-.581-.038-.853-.163l-8.802-4.046-8.324,4.955c-.594.355-1.336.339-1.915-.037-.578-.376-.894-1.046-.814-1.731l1.132-9.62-7.287-6.384c-.519-.455-.735-1.165-.556-1.831.179-.665.719-1.173,1.396-1.309l9.5-1.898,3.821-8.901c.271-.635.879-1.058,1.57-1.095s1.34.321,1.677.923l4.742,8.447,9.649.883c.688.063,1.279.51,1.526,1.154.248.643.106,1.372-.359,1.88h.001l-.004-.004Z"
        />
      </g>
    </SvgIcon>
  );
};

export default Logo3;
