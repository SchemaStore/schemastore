# NIST maintains OSCAL content for NIST Special Publication 800-53

NIST is maintaining OSCAL content for multiple revisions of the NIST Special Publication (SP) 800-53.  The XML, JSON, and YAML versions of SP800-53 given here are derived from the NIST publications. The OSCAL XML, JSON, and YAML variants are all equivalent in their information content and are provided to support tooling on different format-specific implementation stacks. These OSCAL files are intended to faithfully represent the control-related content from the published documents in machine-readable formats.

OSCAL XML-, JSON-, and YAML-based content is provided for the following SP 800-53 revisions:

- NIST [SP 800-53 Revision 4][sp800-53-rev4] control catalog and baselines are provided in OSCAL in [rev4](rev4), as:
   - an OSCAL control catalog file that captures the SP 800-53 rev 4 and SP 800-53A rev4, combined; and
   - an OSCAL profile file for each of the SP 800-53 rev 4 baselines.
-  NIST [SP 800-53 Revision 5][sp800-53-rev5] control catalog, and [SP 800-53B][sp800-53B] baselines are provided in OSCAL in [rev5](rev5), as:
   - an OSCAL controls catalog file that captures the SP 800-53 rev 5. This catalog includes information provided by [SP 800-53A Revision 5][sp800-53A] *Assessing Security and Privacy Controls in Information Systems and Organizations*;
   - an OSCAL profile file for each of the SP 800-53B baselines, including the PRIVACY baseline, intended to be used in combination with others to add privacy-oriented controls.

Note: In the SP 800-53 Revision 5, the control catalog and control baselines are published in separate documents. The control baselines are published as [SP 800-53B][sp800-53B].

Please refer to the [publication announcement][sp800-53-rev5-announcement] for more information.

[sp800-53-rev4]: https://csrc.nist.gov/publications/detail/sp/800-53/rev-4/final
[sp800-53-rev5]: https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
[sp800-53-rev5-announcement]: https://csrc.nist.gov/News/2022/security-privacy-control-assessment-procedures
[sp800-53B]: https://csrc.nist.gov/publications/detail/sp/800-53b/final
[sp800-53A]: https://csrc.nist.gov/publications/detail/sp/800-53a/rev-5/final
