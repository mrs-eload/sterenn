import type { SvgIconProps } from '@mui/material';
import { SvgIcon } from '@mui/material';

export interface Logo5Props extends SvgIconProps {
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

export const Logo5 = ({
  letterColor = '#121f36',
  ringColor = '#121f36',
  starColor = '#f7931e',
  weight = 0,
  ...props
}: Logo5Props) => {
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
          d="M82.796,91.528l-11.548,12.513,3.761,16.603c.27,1.183-.159,2.414-1.1,3.179-.531.432-1.178.67-1.837.707-.508.028-1.021-.067-1.499-.286l-15.471-7.112-14.63,8.708c-1.044.624-2.347.596-3.366-.065-1.017-.661-1.571-1.839-1.43-3.043l1.989-16.908-12.807-11.22c-.913-.799-1.292-2.047-.977-3.218.314-1.169,1.264-2.061,2.454-2.301l16.698-3.336,6.717-15.644c.476-1.116,1.546-1.86,2.759-1.925s2.354.564,2.948,1.622l8.334,14.847,16.959,1.553c1.208.111,2.248.896,2.682,2.029.437,1.13.187,2.412-.631,3.304h.002l-.007-.007Z"
        />
      </g>
    </SvgIcon>
  );
};

export default Logo5;
