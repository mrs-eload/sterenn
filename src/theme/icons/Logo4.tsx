import type { SvgIconProps } from '@mui/material';
import { SvgIcon } from '@mui/material';

export interface Logo4Props extends SvgIconProps {
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

export const Logo4 = ({
  letterColor = '#121f36',
  ringColor = '#121f36',
  starColor = '#f7931e',
  weight = 0,
  ...props
}: Logo4Props) => {
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
    <SvgIcon {...props} viewBox="0 0 221.347 159.198" fill="none">
      <g data-name="Layer 1">
        <g data-name="S" fill={letterColor} {...stroke(letterColor)}>
          <path d="M91.862,88.57c2.331.666,4.724,1.333,7.121,1.999,13.702-5.573,27.316-11.359,40.823-17.385-5.052-2.654-10.986-4.719-17.816-6.323-7.975-2.214-15.286-3.987-21.932-5.98-9.303-3.323-13.955-8.197-13.955-17.28,0-6.423,2.88-13.069,9.968-15.949,6.423-2.438,13.069-2.659,21.266-2.659,9.968,0,23.703,1.329,36.108,2.88V3.284c-14.842-1.773-28.355-2.659-39.21-2.659-16.171,0-29.242,1.329-40.539,8.418-12.626,7.754-18.164,22.153-18.164,37.217,0,24.367,12.405,35.665,36.33,42.31Z" />
          <path d="M83.644,158.231c5.521.236,10.66.342,15.306.342,17.721,0,31.678-1.552,42.976-8.641,8.424-5.11,13.638-12.981,16.38-21.832-24.516,10.941-49.426,20.985-74.662,30.131Z" />
        </g>
        <path
          data-name="ring"
          fill={ringColor}
          {...stroke(ringColor)}
          d="M175.223,44.016c9.982-4.169,33.234-13.253,42.756-6.773,3.468,2.27,4.013,7.473,2.743,10.901-1.279,4.186-3.73,7.821-6.172,11.187-15.63,17.417-33.842,32.7-53.924,45.024-29.954,18.34-63.561,30.501-98.221,35.905-12.919,2.051-26.069,3.085-39.206,2.884-8.03-.145-25.867-.412-22.863-12.72,3.86-10.357,24.322-20.311,34.074-24.836-4.619,3.415-9.133,6.934-13.485,10.574-4.173,3.575-8.47,7.397-11.767,11.678-1.06,1.429-2.002,2.819-2.319,4.382-.04.349.016.56.068.594.048.038.049-.033.188.054.124.073.371.234.772.38,5.865,1.808,13.02.583,19.194.145,11.099-1.034,22.185-2.897,33.126-5.21,32.735-6.999,64.532-18.759,93.584-35.377,18.885-10.586,38.838-25.635,53.829-39.154,2.605-3.034,5.683-6.307,6.402-10.116-.011-.422.045-.526-.28-.932-6.668-4.854-29.936-.088-38.5,1.411h0Z"
        />
        <path
          data-name="star"
          fill={starColor}
          {...stroke(starColor)}
          d="M69.45,93.241l-6.57,7.12,2.14,9.447c.154.673-.091,1.374-.626,1.809-.302.246-.67.381-1.045.402-.289.016-.581-.038-.853-.163l-8.802-4.046-8.324,4.955c-.594.355-1.336.339-1.915-.037-.578-.376-.894-1.046-.814-1.731l1.132-9.62-7.287-6.384c-.519-.455-.735-1.165-.556-1.831.179-.665.719-1.173,1.396-1.309l9.5-1.898,3.821-8.901c.271-.635.879-1.058,1.57-1.095s1.34.321,1.677.923l4.742,8.447,9.649.883c.688.063,1.279.51,1.526,1.154.248.643.106,1.372-.359,1.88h.001l-.004-.004Z"
        />
      </g>
    </SvgIcon>
  );
};

export default Logo4;
