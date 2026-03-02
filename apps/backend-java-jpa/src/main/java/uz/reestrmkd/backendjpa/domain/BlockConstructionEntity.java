package uz.reestrmkd.backendjpa.domain;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Getter @Setter @Entity @Table(name = "block_construction")
public class BlockConstructionEntity extends BaseEntity {
    @Column(name = "block_id", nullable = false, unique = true) private String blockId;
    @Column(name = "foundation") private String foundation;
    @Column(name = "walls") private String walls;
    @Column(name = "slabs") private String slabs;
    @Column(name = "roof") private String roof;
    @Column(name = "seismicity") private Integer seismicity;
}