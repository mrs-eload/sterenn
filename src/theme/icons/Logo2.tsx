import type { SvgIconProps } from '@mui/material';
import { SvgIcon } from '@mui/material';

export interface Logo2Props extends SvgIconProps {
  /** Color of the two dark arcs (data-name="circle1|circle2"). */
  circleColor?: string;
  /** Color of the ring sweep (data-name="ring"). */
  ringColor?: string;
  /** Color of the comet / shooting-star (data-name="star"). */
  starColor?: string;
  /**
   * Constant-pixel outline added on top of each filled shape to keep the thin
   * arcs/ring from looking starved at small render sizes. Because it uses a
   * non-scaling stroke, the weight is in *screen pixels* and stays put as the
   * icon scales down. Set to 0 to disable.
   */
  weight?: number;
}

export const Logo2 = ({
  circleColor = '#121f36',
  ringColor = '#121f36',
  starColor = '#f7931e',
  weight = 0,
  ...props
}: Logo2Props) => {
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
    <SvgIcon {...props} viewBox="0 0 266.541 233.116" fill="none">
      <g data-name="Layer 1">
        <g data-name="star" fill={starColor} {...stroke(starColor)}>
          <path d="M86.195,136.627l-2.748,23.356c31.965-5.225,64.497-16.226,88.032-26.71,2.995-1.334,6.087-2.735,9.239-4.203l29.195-31.637.015.016c2.24-2.445,2.923-5.958,1.726-9.054-1.191-3.104-4.041-5.257-7.354-5.561l-46.49-4.256-22.846-40.701c-1.628-2.901-4.757-4.624-8.082-4.446s-6.258,2.217-7.563,5.276l-18.412,42.886-45.774,9.146c-3.262.659-5.865,3.104-6.727,6.308-.861,3.211.177,6.631,2.679,8.823l35.108,30.757Z" />
          <path d="M183.942,156.83c-13.109,5.916-26.453,11.092-39.803,15.457l32.269,14.833c1.311.602,2.717.861,4.111.785,1.805-.101,3.579-.754,5.035-1.938,2.578-2.096,3.756-5.472,3.015-8.715l-4.627-20.422Z" />
          <path d="M81.126,186.715c.611,1.858,1.833,3.498,3.536,4.604,2.793,1.811,6.365,1.888,9.228.177l16.75-9.97c-9.984,2.235-19.857,3.982-29.514,5.188Z" />
        </g>
        <path
          data-name="circle1"
          fill={circleColor}
          {...stroke(circleColor)}
          d="M227.612,133.729c-8.153,46.396-48.742,81.763-97.438,81.763-26.29,0-50.215-10.31-67.952-27.097-4.083.214-8.118.335-12.084.335h-.002c-3.667,0-7.305-.104-10.85-.284,21.253,26.814,54.095,44.046,90.889,44.046,62.588,0,113.743-49.856,115.857-111.938-6.494,5.315-12.994,9.767-18.419,13.176Z"
        />
        <path
          data-name="circle2"
          fill={circleColor}
          {...stroke(circleColor)}
          d="M39.696,162.86c1.024.059,2.083.095,3.142.132-7.396-13.855-11.597-29.662-11.597-46.434,0-54.552,44.381-98.933,98.933-98.933,49.57,0,90.739,36.647,97.845,84.271,5.087-3.849,9.813-7.929,13.975-12.253.26-.27.505-.539.754-.809C230.288,38.253,184.546.625,130.173.625,66.248.625,14.24,52.632,14.24,116.558c0,15.46,3.05,30.219,8.566,43.718,3.654,1.161,9.02,2.138,16.889,2.585Z"
        />
        <path
          data-name="ring"
          fill={ringColor}
          {...stroke(ringColor)}
          d="M50.137,178.728c-3.797,0-7.581-.103-11.248-.307-6.249-.346-27.258-2.339-35.232-13.438-2.966-4.128-3.761-8.959-2.362-14.359.224-.863.993-1.446,1.847-1.446.102,0,.205.009.308.026.972.16,1.665,1.042,1.601,2.039-.314,4.886.875,8.796,3.633,11.953,6.524,7.469,20.5,9.084,30.446,9.648,2.928.167,5.987.251,9.092.251,43.087,0,94.024-15.852,127.327-30.688,24.074-10.724,54.202-25.625,73.65-45.83,3.443-3.577,14.412-16.026,10.979-26.011-1.99-5.787-7.505-8.529-12.519-10.644l-4.055-1.711c-.792-.335-1.268-1.163-1.163-2.027s.764-1.55,1.613-1.68c.513-.079,1.036-.118,1.552-.118,3.057,0,5.622,1.371,7.884,2.58.511.273,1.018.544,1.527.797,4.872,2.422,8.3,6.281,9.915,11.158,1.712,5.172,1.177,10.992-1.506,16.387-9.874,19.853-34.633,36.133-44.819,42.211-53.74,32.066-116.719,51.21-168.469,51.21Z"
        />
      </g>
    </SvgIcon>
  );
};

export default Logo2;
