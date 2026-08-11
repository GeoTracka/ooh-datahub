import { RecoveryNotice } from "@/features/RecoveryNotice";
import { describePackageConstraint } from "@/features/recoveryCopy";

export function PackageConstraintNotice({ reasonCodes }: { reasonCodes: string[] }) {
  if (reasonCodes.length === 0) return null;
  const descriptions = reasonCodes.map((code) => ({ code, ...describePackageConstraint(code) }));
  const title = reasonCodes.length === 1
    ? descriptions[0].title
    : "This package needs a few changes before you can continue";

  return (
    <RecoveryNotice
      ariaLabel="Package constraints"
      title={title}
      tone="warning"
      technicalCode={reasonCodes.join(", ")}
    >
      {reasonCodes.length === 1 ? (
        <p>{descriptions[0].message}</p>
      ) : (
        <ul>
          {descriptions.map((item) => <li key={item.code}>{item.message}</li>)}
        </ul>
      )}
    </RecoveryNotice>
  );
}
